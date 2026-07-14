import json
import os
import re
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any
from urllib.parse import urlencode
import xml.etree.ElementTree as ET

import requests
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT / ".env")


def normalize_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def fetch_gnews_articles() -> List[Dict[str, Any]]:
    api_key = os.getenv("GNEWS_API_KEY")
    if not api_key:
        return []

    params = {
        "apikey": api_key,
        "country": "US",
        "lang": "en",
        "max": 80,
    }
    url = f"https://gnews.io/api/v4/top-headlines?{urlencode(params)}"
    response = requests.get(url, timeout=25)
    response.raise_for_status()
    payload = response.json()

    articles = []
    for article in payload.get("articles", []):
        title = (article.get("title") or "").strip()
        description = (article.get("description") or "").strip()
        source = (article.get("source") or {}).get("name") or "Unknown"
        if not title:
            continue
        articles.append({
            "title": title,
            "lede": description,
            "source": source,
            "url": article.get("url") or "",
            "origin": "gnews",
        })
    return articles


def fetch_google_news_articles() -> List[Dict[str, Any]]:
    url = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"
    response = requests.get(url, timeout=25)
    response.raise_for_status()

    root = ET.fromstring(response.text)
    articles: List[Dict[str, Any]] = []
    for item in root.findall("./channel/item")[:60]:
        title = (item.findtext("title") or "").strip()
        description = (item.findtext("description") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title:
            continue

        title = re.sub(r"<[^>]+>", "", title)
        description = re.sub(r"<[^>]+>", "", description)
        description = re.sub(r"\s+", " ", description).strip()
        source = "Google News"
        if link:
            source = link.split("/")[2] if "//" in link else source

        articles.append({
            "title": title,
            "lede": description,
            "source": source,
            "url": link,
            "origin": "google-news",
        })
    return articles


def fetch_articles() -> List[Dict[str, Any]]:
    articles: List[Dict[str, Any]] = []

    try:
        articles.extend(fetch_gnews_articles())
    except Exception as exc:
        print(f"GNews unavailable: {exc}")

    try:
        articles.extend(fetch_google_news_articles())
    except Exception as exc:
        print(f"Google News unavailable: {exc}")

    # GNews's free tier caps a single request at 10 articles, which is too
    # few/diverse to cluster on its own, so we combine it with Google News
    # RSS (many outlets, no key required) to get enough volume for outlets
    # to actually overlap on the same story.
    return articles


def cluster_articles(articles: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    if not articles:
        return []

    texts = [f"{item['title']} {item['lede']}" for item in articles]
    normalized_texts = [normalize_text(text) for text in texts]

    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=500)
    matrix = vectorizer.fit_transform(normalized_texts)

    clusters: List[List[Dict[str, Any]]] = []
    for index, article in enumerate(articles):
        article_vec = matrix[index]
        best_cluster_index = None
        best_score = 0.0

        for cluster_index, cluster in enumerate(clusters):
            cluster_text = " ".join([normalize_text(f"{item['title']} {item['lede']}") for item in cluster])
            cluster_vec = vectorizer.transform([cluster_text])
            score = cosine_similarity(article_vec, cluster_vec)[0][0]
            if score > best_score:
                best_score = score
                best_cluster_index = cluster_index

        if best_cluster_index is not None and best_score >= 0.16:
            clusters[best_cluster_index].append(article)
        else:
            clusters.append([article])

    return [cluster for cluster in clusters if len(cluster) >= 2]


def build_fallback_summary(cluster: List[Dict[str, Any]]) -> Dict[str, str]:
    top_titles = [item["title"] for item in cluster[:4]]
    title = top_titles[0]
    if len(top_titles) > 1:
        title = title.split(" - ")[0].strip()

    summary = (
        f"Multiple outlets are covering {title}. The common thread across reports appears to be the same core event, "
        "while the details and emphasis vary by outlet."
    )

    sources = sorted({item["source"] for item in cluster})
    if len(sources) >= 2:
        disagreement = (
            "Coverage seems to differ mostly in emphasis and framing rather than in a clear contradiction. "
            f"The outlets most represented here are {', '.join(sources[:4])}."
        )
    else:
        disagreement = "The available headlines do not show a strong factual split, but the tone and emphasis still vary by outlet."

    return {"summary": summary, "disagreement": disagreement}


def call_llm_summary(cluster: List[Dict[str, Any]]) -> Dict[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return build_fallback_summary(cluster)

    prompt = (
        "You are writing a neutral, non-sentimental news synthesis. "
        "Given several headlines from different outlets, produce a concise summary of the shared facts and a brief note on where coverage may differ. "
        "Do not add speculation. Keep it factual and balanced.\n\n"
        + "\n".join([f"- {item['title']} [{item['source']}]" for item in cluster[:6]])
    )

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4.1-mini",
                "messages": [
                    {"role": "system", "content": "You are a neutral news synthesis assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
            },
            timeout=40,
        )
        response.raise_for_status()
        payload = response.json()
        content = payload["choices"][0]["message"]["content"].strip()
        lines = [line.strip() for line in content.split("\n") if line.strip()]
        if len(lines) >= 2:
            return {"summary": lines[0], "disagreement": lines[1]}
    except Exception as exc:
        print(f"LLM call failed; using fallback summary: {exc}")

    return build_fallback_summary(cluster)


def rank_clusters(clusters: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    scored = []
    for cluster in clusters:
        outlet_count = len({item["source"] for item in cluster})
        scored.append({
            "cluster": cluster,
            "outlet_count": outlet_count,
            "article_count": len(cluster),
        })
    scored.sort(key=lambda item: (item["outlet_count"], item["article_count"]), reverse=True)
    return scored


def build_output(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    clusters = cluster_articles(articles)
    ranked = rank_clusters(clusters)[:8]

    stories = []
    for item in ranked:
        cluster = item["cluster"]
        synthesis = call_llm_summary(cluster)
        stories.append({
            "article_count": item["article_count"],
            "outlet_count": item["outlet_count"],
            "summary": synthesis["summary"],
            "disagreement": synthesis["disagreement"],
            "headlines": [
                {
                    "title": article["title"],
                    "source": article["source"],
                    "lede": article["lede"],
                    "url": article["url"],
                }
                for article in cluster[:6]
            ],
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_count": len(articles),
        "story_count": len(stories),
        "stories": stories,
    }


def write_to_supabase(payload: Dict[str, Any]) -> None:
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        print("Supabase env vars not set; skipping database write.")
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    today = datetime.now(timezone.utc).date().isoformat()

    # Clear out any existing rows for today's general feed before re-inserting,
    # so re-running the pipeline the same day doesn't duplicate stories.
    delete_response = requests.delete(
        f"{supabase_url}/rest/v1/stories",
        headers=headers,
        params={"story_date": f"eq.{today}", "category": "eq.general"},
        timeout=25,
    )
    delete_response.raise_for_status()

    rows = [
        {
            "story_date": today,
            "category": "general",
            "rank": index,
            "summary": story["summary"],
            "disagreement": story["disagreement"],
            "outlet_count": story["outlet_count"],
            "article_count": story["article_count"],
            "headlines": story["headlines"],
            "generated_at": payload["generated_at"],
        }
        for index, story in enumerate(payload["stories"])
    ]

    if not rows:
        return

    insert_response = requests.post(
        f"{supabase_url}/rest/v1/stories",
        headers=headers,
        json=rows,
        timeout=25,
    )
    insert_response.raise_for_status()
    print(f"Wrote {len(rows)} stories to Supabase for {today}.")


def write_outputs(payload: Dict[str, Any]) -> None:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = OUTPUT_DIR / f"{timestamp}_stories.json"
    text_path = OUTPUT_DIR / f"{timestamp}_stories.txt"

    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)

    with text_path.open("w", encoding="utf-8") as handle:
        handle.write("Top synthesized stories\n")
        handle.write("=" * 40 + "\n")
        for index, story in enumerate(payload["stories"], start=1):
            handle.write(f"\n{index}. {story['summary']}\n")
            handle.write(f"   Outlets: {story['outlet_count']} | Articles: {story['article_count']}\n")
            handle.write(f"   Disagreement note: {story['disagreement']}\n")
            handle.write("   Headlines:\n")
            for headline in story["headlines"]:
                handle.write(f"   - {headline['title']} [{headline['source']}]\n")

    print(f"Wrote JSON output to {json_path}")
    print(f"Wrote text output to {text_path}")


def main() -> None:
    print("Fetching current headlines...")
    articles = fetch_articles()
    if not articles:
        print("No articles were fetched. Check your network connection or API key configuration.")
        return

    print(f"Collected {len(articles)} articles. Building clusters...")
    payload = build_output(articles)
    write_outputs(payload)
    write_to_supabase(payload)

    print("\nPreview of the top synthesized stories:\n")
    for story in payload["stories"][:5]:
        print(f"- {story['summary']}")
        print(f"  Disagreement: {story['disagreement']}\n")


if __name__ == "__main__":
    main()
