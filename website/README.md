# website

The Manhattan project site. It is static HTML, CSS and one ES module, with no dependencies and no build step.

```sh
npx http-server -p 8080     # from this folder; or: python -m http.server 8080
```

It needs a server because `main.js` is an ES module, which browsers won't load from `file://`.

| file | what |
|---|---|
| `index.html` | the page |
| `styles.css` | styles; colours follow the viewer's own palette |
| `main.js` | the zoom walkthrough, the URL anatomy card, scroll reveals |
| `img/` | captures of the real viewer, rendered headless (SwiftShader) from the private repo's designs |

Every number on the page comes from the private Manhattan repo's measurements.

© 2026 Natanel Yanchevsky. All rights reserved. See [../LICENSE](../LICENSE).
