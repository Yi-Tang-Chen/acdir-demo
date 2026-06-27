# ACDiR Demo Site

This folder is a self-contained static demo for the oral-defense presentation.
It can be deployed directly with GitHub Pages.

## Local Preview

```bash
python -m http.server 8000 -d Paper/demo
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages Setup

The repository already has this remote:

```text
https://github.com/Yi-Tang-Chen/project.git
```

### Fastest Path

You already pushed the project branch, so the quickest setup is:

1. Open GitHub `Settings -> Pages`.
4. Choose `Deploy from a branch`.
5. Set branch to `acdir-v2-2` and folder to `/ (root)`.

The demo URL will be:

```text
[https://yi-tang-chen.github.io/project/Paper/demo/](https://yi-tang-chen.github.io/acdir-demo/)
```

### Clean Root URL

If you want the shorter URL below, publish only `Paper/demo` to a `gh-pages`
branch:

```text
https://yi-tang-chen.github.io/project/
```

Some cluster Git builds do not include `git subtree`. This no-subtree version
uses a temporary directory instead:

```bash
tmpdir="$(mktemp -d)"
cp -a Paper/demo/. "${tmpdir}/"

(
  cd "${tmpdir}"
  git init
  git switch -c gh-pages
  git add .
  git commit -m "Deploy ACDiR demo"
  git remote add origin https://github.com/Yi-Tang-Chen/project.git
  git push -f origin gh-pages:gh-pages
)

rm -rf "${tmpdir}"
```

Then open GitHub `Settings -> Pages` and set:

```text
Branch: gh-pages
Folder: / (root)
```

If your Git has `git subtree`, this equivalent shortcut also works:

```bash
git subtree split --prefix Paper/demo -b gh-pages
git push -f origin gh-pages:gh-pages
git branch -D gh-pages
```
