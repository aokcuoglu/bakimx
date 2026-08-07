#!/usr/bin/env bash
# Reconcile the "Factory - BakimX" GitHub Project board with real issue state.
#
# Why this exists: the project's built-in automations can leave a card's Status
# out of sync with the issue itself. The known failure mode was the
# "Pull request linked to issue" workflow (now disabled) flipping an already
# closed issue back to In Progress when its PR was linked after the fact.
# This script is the safety net: closed issue => Status Done.
#
# It only writes the Status field of items whose issue is CLOSED. It never
# touches issues, pull requests, branches, or any other project field.
#
# Usage:
#   bun run project:sync              # fix closed-but-not-Done cards
#   bun run project:sync -- --dry-run # report only, change nothing
#
# Env overrides: PROJECT_OWNER (default: authenticated user), PROJECT_NUMBER (default: 2)

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=1 ;;
    --help|-h)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required (https://cli.github.com)." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

OWNER="${PROJECT_OWNER:-$(gh api user --jq .login)}"
NUMBER="${PROJECT_NUMBER:-2}"

meta=$(gh api graphql \
  -f query='query($login:String!,$num:Int!){
    user(login:$login){ projectV2(number:$num){
      id title
      field(name:"Status"){ ... on ProjectV2SingleSelectField{ id options{ id name } } }
    } } }' \
  -F login="$OWNER" -F num="$NUMBER" \
  --jq '.data.user.projectV2 | [.id, .title, .field.id, (.field.options[] | select(.name=="Done") | .id)] | @tsv')

IFS=$'\t' read -r PROJECT_ID PROJECT_TITLE FIELD_ID DONE_OPTION_ID <<<"$meta"

if [[ -z "${PROJECT_ID:-}" || -z "${FIELD_ID:-}" || -z "${DONE_OPTION_ID:-}" ]]; then
  echo "Could not resolve project $OWNER/#$NUMBER or its Status/Done option." >&2
  exit 1
fi

echo "Project: $PROJECT_TITLE ($OWNER/#$NUMBER)"
[[ $DRY_RUN -eq 1 ]] && echo "Mode: dry-run (no changes will be written)"

items=$(gh api graphql --paginate \
  -f query='query($login:String!,$num:Int!,$endCursor:String){
    user(login:$login){ projectV2(number:$num){
      items(first:100, after:$endCursor){
        pageInfo{ hasNextPage endCursor }
        nodes{
          id
          content{
            __typename
            ... on Issue{ number state }
            ... on PullRequest{ number state }
          }
          fieldValueByName(name:"Status"){
            ... on ProjectV2ItemFieldSingleSelectValue{ name }
          }
        } } } } }' \
  -F login="$OWNER" -F num="$NUMBER" \
  --jq '.data.user.projectV2.items.nodes[]
        | select(.content.__typename == "Issue")
        | [.id, (.content.number|tostring), .content.state, (.fieldValueByName.name // "—")]
        | @tsv')

fixed=0
warned=0

while IFS=$'\t' read -r item_id number state status; do
  [[ -z "${item_id:-}" ]] && continue

  if [[ "$state" == "CLOSED" && "$status" != "Done" ]]; then
    if [[ $DRY_RUN -eq 1 ]]; then
      echo "  would fix  #$number  $status -> Done"
    else
      gh api graphql \
        -f query='mutation($project:ID!,$item:ID!,$field:ID!,$option:String!){
          updateProjectV2ItemFieldValue(input:{
            projectId:$project, itemId:$item, fieldId:$field,
            value:{ singleSelectOptionId:$option }
          }){ projectV2Item{ id } } }' \
        -f project="$PROJECT_ID" -f item="$item_id" -f field="$FIELD_ID" -f option="$DONE_OPTION_ID" \
        >/dev/null
      echo "  fixed      #$number  $status -> Done"
    fi
    fixed=$((fixed + 1))
  elif [[ "$state" == "OPEN" && "$status" == "Done" ]]; then
    # Reported, never auto-changed: an open issue in Done is a human decision.
    echo "  warning    #$number is OPEN but sits in Done"
    warned=$((warned + 1))
  fi
done <<<"$items"

if [[ $fixed -eq 0 && $warned -eq 0 ]]; then
  echo "Board is in sync — every closed issue is Done."
elif [[ $DRY_RUN -eq 1 ]]; then
  echo "Drift found: $fixed card(s) would move to Done, $warned warning(s)."
else
  echo "Done: $fixed card(s) moved to Done, $warned warning(s)."
fi
