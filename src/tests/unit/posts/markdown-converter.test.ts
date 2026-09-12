import assert from "node:assert/strict";
import test from "node:test";
import {MarkdownConverter} from "../../../ingestion/markdown-converter.js";


test("converts article HTML to markdown", () => {
  const html = `
<h1>My Test Article</h1>

<p>
This is the first paragraph.
</p>

<p>
This is the second paragraph.
</p>

<h2>Features</h2>

<ul>
<li>Feature one</li>
<li>Feature two</li>
</ul>

<p>
Visit <a href="https://example.com">Example</a>.
    </p>
        `;

  const converter = new MarkdownConverter();

  const result = converter.convert(html);

  assert.match(result, /^# My Test Article/m);

  assert.match(
    result,
    /This is the first paragraph\./,
  );

  assert.match(
    result,
    /This is the second paragraph\./,
  );

  assert.match(result, /^## Features/m);

    assert.match(result, /Feature one/);
    assert.match(result, /Feature two/);

  assert.match(
    result,
    /\[Example\]\(https:\/\/example\.com\)/,
  );
});
