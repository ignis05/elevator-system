# abort on errors
set -e
# clear build
rm -rf build
# build
npm run build
# create tmp git repo, commit and push to gh-pages branch
cd build
git init
git add -A
git commit -m 'deploy through script'
git push -f git@github.com:ignis05/elevator-system.git master:gh-pages
# delete created git repo
rm -rf .git
