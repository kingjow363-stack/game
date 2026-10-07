# Evolve Industry Desktop r2 (based on Evolve 1.4.10)

This is an unofficial personal desktop modification of Evolve Idle.
Original game: Peter Motschmann and the Evolve contributors.
Original project: https://github.com/pmotschmann/Evolve
Original release: 1.4.10
Source snapshot: 3436358dcd03d9f9e071d51ea071e0a78c0322e4

Evolve source and compiled game code are governed by Mozilla Public License 2.0.
The complete, unmodified baseline and original license notices are preserved at:
https://github.com/kingjow363-stack/game/tree/main/evolve-desktop/upstream

Industry r2 modifications: a separate industry state/automation/production/
prestige module and UI; checked patches to main.js, prod.js, functions.js and
resets.js; a rebuilt game bundle; periodic desktop backups and recovery controls.
Original early progression, achievements, content and reset rewards are retained.
The original wiki, translations, worker and CSS are unchanged. New industry UI
styles are provided separately. The wiki describes the original game.

Modified module sources and the exact patch/build script are available at:
https://github.com/kingjow363-stack/game/tree/main/evolve-desktop/mods
https://github.com/kingjow363-stack/game/blob/main/scripts/build-evolve-mod.cjs
The build includes Evolve-Original-Source and Evolve-Industry-Source downloads;
the latter contains the actual patched sources and PATCHES.json. New industry
module files are also licensed under MPL-2.0. The license is in web/LICENSE.

Desktop adaptation packages the exact original CDN library versions and checks
their original SRI hashes. Generated HTML uses local dependency paths and removes
the external analytics loader. Runtime library licenses remain in web/vendor and
Lato's license in web/vendor/lato/LICENSE. Other upstream library/font notices
remain alongside their files. Community/support links open the system browser.

The separate EXO Industries game and its saves are not used by this modification.
