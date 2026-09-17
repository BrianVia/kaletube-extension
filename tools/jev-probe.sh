#!/bin/bash
# Self-check for the Jev classifier question used in src/background.ts.
# Sends a few known titles and asserts the category. Reads the key from
# $TYPESAFE_API_KEY or ~/.config/typesafe/api_key; never prints it.
set -e
KEY="${TYPESAFE_API_KEY:-$(cat ~/.config/typesafe/api_key)}"
ask() { # title creator expected
  body=$(jq -n --arg t "$1" --arg c "$2" '{
    state:{video:{title:$t,creator:$c}}, model:"jev-latest",
    questions:{category:{type:"choice",
      instructions:"This is a YouTube homepage video card seen during work hours. Classify the kind of content so distracting videos can be hidden.",
      criteria:{
        educational:"Teaches, informs, or explains: business, productivity, leadership, finance, investing, economics, career, communication, fitness, health, self-improvement, mindset, programming, science, history, engineering",
        ambient_music:"Music or sound suitable as background while working or exercising: EDM mixes, lo-fi, ambient, study/focus playlists, film soundtracks, workout mixes",
        distraction:"Entertainment with no learning or work value: video games and esports, memes, TikTok trends, reactions, movie/TV/anime reviews or clips, celebrity gossip, cooking and eating shows, vlogs, pranks, sports highlights"}}}}')
  got=$(curl -s https://api.typesafe.ai/v1/systemone -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d "$body" | jq -r '.answers.category.choice')
  [ "$got" = "$3" ] && echo "ok   $3  <- $1" || { echo "FAIL want $3 got $got <- $1"; exit 1; }
}
ask "How I Built a \$10M SaaS in 2 Years" "Starter Story" educational
ask "lofi hip hop radio - beats to relax/study to" "Lofi Girl" ambient_music
ask "s1mple INSANE ace on Mirage | FACEIT Level 10" "CS2 Clips" distraction
ask "The Social Network Soundtrack - Hand Covers Bruise" "Trent Reznor" ambient_music
ask "I ate at every Taco Bell in Ohio" "MrBeast" distraction
