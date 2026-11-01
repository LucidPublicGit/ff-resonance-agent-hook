# Final Fantasy Resonance — GSM Agent hook

Experimental text hook for the Steam PC version of **FINAL FANTASY RESONANCE**, for use with [GameSentenceMiner](https://github.com/bpwhelan/GameSentenceMiner).

## Install

1. Download both JavaScript files from this repository.
2. Place them together in GSM's `agent-scripts/scripts` folder. On Windows this is usually `%APPDATA%\GameSentenceMiner\agent-scripts\scripts`.
3. In GSM's Agent settings, select `FFRS-Win64-Shipping.exe` and **FINAL FANTASY RESONANCE (experimental)**.
4. Attach the hook. After updating either file, stop and reattach.

Both files are required:

- `PC_Steam_FINAL_FANTASY_RESONANCE.js` — the game hook (v0.4.0).
- `libUnrealEngine_FFRS.js` — its local Unreal Engine compatibility library.

## Captures

- Normal dialogue
- Event and battle caption widgets
- Centered narration captions resolved through the active talk-window manager
- Tutorial titles and explanations

The hook watches text changes and checks for replacement widgets every 1.5 seconds.

## Limitations

- Movie cutscene subtitles are not supported. Use OCR for those scenes.
- Speaker names and general menus are excluded.
- Running OCR and the hook on the same dialogue can produce duplicate captures. Switch between them as needed.
- This is experimental and was tested on one installed PC build. Game updates may change memory layouts.
- Matching widgets can retain older text; attaching can emit retained dialogue or tutorial text.

## Attribution and license

`libUnrealEngine_FFRS.js` is adapted from [0xDC00/scripts](https://github.com/0xDC00/scripts/blob/main/libUnrealEngine.js), by [DC], using the locally installed upstream revision `70b819eb9ffdf259441727976d3048e07254536f`. Changes include safer range reads, reduced diagnostic logging, and enumeration of the game's text widgets.

MIT license; upstream copyright and permission notice are preserved in [LICENSE](LICENSE).
