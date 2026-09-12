import assert from "node:assert/strict";
import test from "node:test";
import {ArticleExtractor} from "../../../ingestion/article-extractor.js";


test("extracts the main article content from HTML", () => {
  const html = `
<!DOCTYPE html>
<html>
    <head>
        <title>My Test Article</title>
</head>

<body>
<header>
    <nav>
        <a href="/">Home</a>
    <a href="/about">About</a>
    </nav>
    </header>

    <main>
    <article>
        <h1>My Test Article</h1>

<p>
This is the first paragraph of the article.
</p>

<p>
This is the second paragraph with useful information.
</p>
</article>
</main>

<aside>
Advertisement
</aside>

<footer>
Copyright 2026
</footer>
</body>
</html>
    `;

  const extractor = new ArticleExtractor();

  const result = extractor.extract(
    html,
    "https://example.com/article",
  );

  assert.equal(result.title, "My Test Article");

  assert.match(
    result.content,
    /This is the first paragraph of the article/,
  );

  assert.match(
    result.content,
    /This is the second paragraph with useful information/,
  );

  assert.doesNotMatch(
    result.content,
    /Advertisement/,
  );

  assert.doesNotMatch(
    result.content,
    /Copyright 2026/,
  );
});

