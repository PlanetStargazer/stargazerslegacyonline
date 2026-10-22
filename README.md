# The Stargazer's Legacy - Online

The single-player RPG, turned into a persistent multiplayer world. The browser client is plain HTML/JS
(`public/`), the backend is PHP + SQLite (`server/`, entry point `public/api.php`).

```
public/            <- the web root
  index.html         the game page (login, character creation, UI)
  css/game.css
  js/game.js         the game (rules, combat, rendering) - the original code, extended
  js/net.js          accounts, polling, chat, groups, shared battles
  api.php            JSON API entry point
server/            <- PHP backend (keep it OUTSIDE the web root)
  config.php lib.php world.php accounts.php social.php battle.php poll.php
  data/sgl.sqlite    created on first request (accounts, saves, chat, battles ...)
start.sh           run it locally
the_stargazer_s_legacy.html   the old single-player file (kept for reference, no longer used)
```

## Running it

Requirements: PHP 8.1+ with the `pdo_sqlite` extension (`sudo dnf install php-cli php-pdo` on Fedora,
`sudo apt install php-cli php-sqlite3` on Debian/Ubuntu). The page loads Tailwind and the fonts from CDNs, so players
need internet access.

```bash
./start.sh                 # http://localhost:8080  (PORT=9000 ./start.sh to change it)
```

Open the address in two browsers (or one normal and one private window), create two accounts and play.

### On a real server

* Apache: set `DocumentRoot` to `.../public`, enable PHP, make `server/data/` writable by the web user.
* nginx + php-fpm: `root .../public; location = /api.php { fastcgi_pass ...; include fastcgi_params; fastcgi_param SCRIPT_FILENAME $document_root/api.php; }`
* The database path can be moved with the environment variable `SGL_DB_PATH`.
* Other knobs (environment variables, see `server/config.php`): `SGL_TURN_MS` (real milliseconds per game hour,
  default 120000 = 2 min, i.e. a day lasts 48 real minutes), `SGL_GROUP_JOIN_RANGE`, `SGL_BATTLE_MAX_PLAYERS`, ...
* Use HTTPS in production (passwords and session tokens travel in requests).

## Administration

Set the administrator password once (it is separate from player accounts), then open `/admin.html`:

```bash
php server/admin-cli.php passwd        # or start with SGL_ADMIN_PASSWORD=...
```

There you can list, rename, sign out and delete accounts, reset passwords, delete characters, and reset the whole world.

## How it works

* **Time** - the world clock is derived from real time (`turn = (now - epoch) / TURN_MS`). One turn is one game hour
  (2 real minutes), so a day lasts 48 real minutes. Walking no longer advances it; it runs the same in the wild,
  in towns and underground. Weather is rolled on the server (seeded per turn) so everyone sees the same sky.
* **The world** - 2400 x 1200 tiles (twice the original map in both directions), with roughened coastlines, inland lakes, wavier
  forests and mountain ranges and about a hundred settlements; old saves are scaled up automatically.
* **Towns** - every settlement is generated from its own seed (`public/js/towngen.js`): street network, plaza, buildings,
  furnished interiors, ponds, trees, lamps and guard patrols differ from town to town, and each town's people (shopkeepers,
  lords, guards) come from all five ancestries. Towns are 30 x 30 tiles; guards, pets and street pedestrians walk fixed routes on the
  shared world clock, so every player sees them in the same place. Doors open when bumped and swing shut again by themselves. Every house has a citizen at home, and every city has a barber who restyles
  a hero's hair, colour and beard for a fee. A town is only accepted when every doorway and every resident can be reached.
* **Friends** - a private contact list (Friends tab, `/friend name`, `/unfriend name`); other players see your character's name,
  never the account name.
* **Resting** - at an inn the hero sleeps in a bed while HP/MP mend (wake up any time with Esc). Camping (`R`) pitches a tent and a fire on the
  spot and mends HP/MP slowly until everyone is whole or you move; every rest uses up one travel ration (bought from
  a provisioner). There is no stamina. Resting never advances the clock.
* **Poison** (marsh water, Poison Field...) now ticks every second on the shared world clock - moving or not - for about 2% of max HP, and it can kill:
  a character that dies of poison wakes at Castle Stargazer at half HP. A poisoned hero's face turns green. Resting (camp or inn) sweats it out after a few seconds.
  Camping and inn rests play their own lullaby.
* **Inventory** - a paper doll (weapon, armour, boots, head) plus a 16-slot bag. Every weapon, armour and magic item takes one slot; Healing Potions
  share one slot and so do Rations. A full bag refuses chest loot and shop purchases. Click or drag items between bag and doll.
* **Settlements** - villages have dirt lanes and log cabins, towns plaster-and-timber houses, castles stone-brick keeps. Doors and windows always stand upright.
  Lord Stargazer is a bald human with light skin and a short grey beard.
* **Accounts & saves** - name + password, one login per account. Each account owns one champion (gender, hair colour and beard are chosen at creation; worn armour and weapon are drawn on the figure), saved
  to the server every 30 s and after battles, rests and purchases.
* **Presence & chat** - clients poll `api.php?a=poll` every 1.5 s (0.6 s in battle). Other players are drawn on the
  overland map and in towns. Chat channels: World, Here, Group and whispers (`/w name text`, `/g`, `/l`, `/invite`).
* **Groups** - up to 4 players. When a group member is ambushed, group members within 10 tiles are pulled into the battle.
* **Shared battles** - a fight is shown on the overland map as a brawl. Players who walk next to it are asked whether to
  join; up to 4 players fight on one tactical map (parties are merged, turns go round in order, 45 s turn clock,
  everyone earns the full XP and gold). The ambushed player's browser *hosts* the combat rules and publishes a snapshot
  after every action; the others send their choices through the server. If the host drops out the server promotes
  another participant, who continues from the last snapshot.
* **Combat** - click a foe to select it, `Q`/AUTO attacks it each turn (waiting while it is out of range); aimed spells use the selection, helpful spells go to yourself while a foe is selected. Monsters are scaled down for a lone champion.
* **Maps, spells, items** are unchanged from the single-player game.

## What changed in the rules

* Sylphs are replaced by **Automata** (living constructs): +1 STR, -1 DEX, +1 HP per level, +1 AC plating, immune to poison.
* New classes **Bard** (spells + five Bardic Songs) and **Tinker** (firearms, grenades, constructs) - see the in-game manual.
* Every hero on the field earns the **full XP** of each foe (it used to go to the killer only); gold is paid to every player.
* One extra song per scene; one of the two is picked at random whenever a scene is entered.

## Trust model

The browser runs the game rules, the server stores the results. The server rejects malformed saves, class/race swaps and
big level jumps, and checks that heroes joining a battle match the saved party - but a determined player with dev tools
could still tamper with their own client. It is built for friends, not for a competitive ladder.

Playtesting: set `SGL_ALLOW_DEBUG=1` to allow the old "Stargazer" debug party (five clicks on the character-creation
title, then name a hero *Stargazer*). It is off by default so nobody can start at level 20.

* **The wider world** - the overworld now has ice caps, taiga, deserts, savannahs and jungles (placed where the real continents have them), sandy coastlines with surf,
  cobbled high roads between towns, castles and harbours (dirt tracks to the villages, bridges over rivers) and signposts at the crossroads (bump into one to read it).
  Ruins are scattered across the land; at night skeletons shamble around them and, very rarely, a ghost drifts out. Run into one to fight it.
* **People** - names fit the gender of shopkeepers, lords, guards and townsfolk of every ancestry. Whoever you talk to stands still until the conversation is over;
  town guards talk too (and share rumours like the citizens do).
* **Beasts and wildlife** - the wilds now hold giant rats, kobolds, giant bats, goblins, giant snakes, wolves, headless and (unmoving) ropers in the swamps; which one
  turns up depends on the terrain. Harmless deer, antelope, hares and mountain goats wander the meadows, savannahs and mountains: hunt them (walk into them) for
  **meat** (counts as a ration at camp, sells to provisioners) and **leather** - they never leave chests.
* **Closed dungeons and moongates** - all dungeon entrances are barred for now, and the moongates only shimmer into being at night.
* **The tailor** - every town, port and castle has a tailor (not villages). Every weapon, hat and armour a hero has ever owned is kept as a look in the pattern book, and for
  30 gold per piece the tailor dresses the model in any of them (going back to the real gear is free). Only the picture changes - the equipment actually worn decides the
  stats. Enchanted gear comes in themed looks: frost, flame, shadow, gilded and verdant (coloured blades with glow and motes, recoloured armour with an emblem and trim).
* **Headgear** - hats and helmets are items of their own with a HEAD slot on the paper doll (and a third cosmetic slot). Hats (wizard hat, circlet, beret, goggles) add +1 max
  mana; caps, coifs and helms add armour class. Enchanted headgear can add mana, mana regeneration (every combat round and every 20 seconds), INT/WIS, HP and more.
  Casters start with their class hat; the smith sells a random selection and chests can hold magic headgear. Plate armour lost 1 AC to make up for helmets.
* **Spawning** - the server only spawns monsters just outside what an adventurer can currently see (their sight radius is reported with every poll), never in view of anybody.
  Every adventurer always has at least one monster in the neighbourhood and 2-3 harmless creatures within ten tiles; ruins and dungeon entrances breed monsters of their own
  (dungeon mouths the nastier kind). One icon on the map is one creature, but the battle holds more as the hero grows - roughly 0.6 foes per (hero level / foe level), at most 10.
* **Spoils** - a won battle pays out automatically: the loot (potions, gear, magic items, now also headgear) is rolled once and each item goes to one of the
  participating players. What does not fit into someone's bag is left in a bag on the ground (visible to everyone) which anyone can walk up to and loot.
  Treasure chests no longer appear after battles. The starting dagger and cloth tunic sell to any shopkeeper for 1 gold.
* **The captain's outfit** - buying a ship's deed adds the harbour master's tricorn, greatcoat and cutlass to the tailor's pattern book (look only; they cost 30 gold each at the tailor).
* **Shop signs and pets** - hanging signs (smith, inn, healer, tailor, pets) stand in the street beside every shop door. Castle Stargazer has a pet shop: dogs and cats in 8 + 8 breeds and
  many colourings (500 gold each). A pet goes into the new PET slot of the character screen and then trots behind the hero on the map and in towns (other players see it too);
  it is purely cosmetic and never appears in battle.
* **Potions and bag** - healing (Minor/Healing/Greater), mana (Minor/Mana/Greater), antidote and recall potions are sold by the provisioner and drop as loot. Right-click a potion in the bag to drink it
  (the old drink button is gone); the recall potion teleports you to Stargazer's Castle (overworld only). Bag items can be dragged into any slot, including empty ones. Healers in town now share the
  standard NPC faces and hair.
* **Potion witch and pet art** - every town, city and castle has a potion witch (some villages too) with her own shop sign: she sells all healing, mana, antidote and recall potions. Provisioners now only
  stock rations and Minor Healing Potions. The pets from the pet seller are drawn with the same dog and cat art as the animals wandering the towns (breed and colouring change the palette and size).
* **Pet polish** - pets are drawn at 75% size, share the hero's tile, beside the left leg, and keep step with every move, stand when you pause, sit after 5 s and cats lick a paw and groom themselves every so often while sitting.
* **Parrots** - the pet seller also sells parrots (macaw, African grey, cockatiel, budgie, lorikeet, 500 gold). A parrot circles above the hero while moving and perches on the shoulder after standing still for 5 s. The seller's own model no longer carries a cat and a puppy.
* **Inn, healer, smith** - inns are larger and hold one or two tables where patrons sit drinking beer. The healer no longer resurrects (only the Resurrect spell raises the fallen); the healer restores HP/MP and cures poison for living heroes. The smith's buy window has tabs for weapons, armor, headgear and magic items/boots.
* **Towns** - plots are 34 x 34 tiles. A shop sign is only put in the street if every tile that could be reached from the gate before can still be reached. Inn patrons lean back, sway while they talk and take turns raising their mugs.
* **Inn bard** - every inn has a bard who strums a lute, taps his foot and sends notes drifting up. Talk to him (NAME, JOB, TOWN, SONG, RUMOR) - he answers everything in rhyming couplets.
* **Music for places** - stepping inside an inn plays a jaunty fiddle jig (6/8), Lord Stargazer's hall (every lord's house) plays a slow, epic D-minor piece for brass, strings and timpani, and the healer's sanctuary plays a slow choir with bells. Leaving the building returns to the town theme (crossfaded).
* **A fuller world** - 140 lakes and oases (with sandy shores), about 1,700 lone trees (oak, acacia, spruce), 180 ruins in eight kinds (columns, walls, arches, stone circles, collapsed towers, sunken stairs, barrows ...), 110 lighthouses on the coasts
  with a sweeping beam, 170 monster encampments that keep spawning one kind of monster (goblins, kobolds, wolves, orcs, bandits, snakes) at five times the usual rate while a player is near, 220 abandoned camps and groups of will-o'-wisps in the
  marshes and on lake shores after dark. Step onto an abandoned camp to search it: the first adventurer takes the gold and gear and it disappears for everybody (it comes back after three real days). Everything is placed from the world seed.
* **Where am I?** - the character's position is no longer shown on the HUD or the world map; the Locate spell tells you (as before), and a **sextant** (150 gold, sold by harbour masters) keeps it displayed while it is switched on in the bag.
* **Gypsy wagons** - at night about half of the roadside wagons near the woods are parked. Walk into one to talk to the fortune teller: a reading costs 100 gold, begins with an ominous prophecy and then grants a boon (sight +4, +50% XP, health or mana regeneration)
  or a curse (half of thy hits miss, or thou art turned into a toad: no attacking or casting, but no enemy attacks thee). A jingle plays for either; the effect lasts one game hour (shown in the HUD).
* **Fixes and polish** - the bag is a list again (name, details, drag to reorder); gold prices show a golden coin instead of "G"; searching an abandoned camp is more robust (looted camps are remembered by position, the server restores a lost camp list and the
  tile can also be searched with Enter); the admin panel shows what is spawned right now (monsters by tier or kind, wildlife, encampment monsters, loot bags, looted camps).
* **Darker nights** - after dusk everything beyond the party's sight fades gradually to black (explored ground too); spells and light still widen the circle of sight. Towns, villages and castles glow in a 3 tile radius (full light for the first tile, then fading). In the deepest dark two small red eyes sometimes open and blink out again.
* **Line of sight** - in settlements house walls, town walls and closed doors hide what is behind them (their outer faces stay visible), while windows and open doors let the view through; trees, furniture, people and animals never block it. On the
  overworld one can look two tiles into a forest (jungle, taiga) and one tile into mountains, everything behind is black. Monsters, wagons and other players are only drawn where they can be seen.
* **General vendor** - every town, city and castle (not the villages) has a general vendor with a "GOODS" sign who buys anything from the bag at half value: weapons, armour, headgear, magic items, potions, rations, meat, hides, pets and sextants.
* **Sight is all there is** - on the overworld nothing beyond the party's sight is drawn any more (no remembered map; the world map [M] still shows what has been explored), apart from the glow of settlements at night. Settlements have no sight limit at all, only walls.
* **Directions** - ask any guard in a town for DIRECTIONS, pick a service from the list (inn, smithy, healer, lord, harbour master, barber, tailor, pets, witch, vendor ...) and a golden arrow bobs over thy head, always pointing along the shortest walkable route (through doors, around houses); it vanishes when thou standest in front of the one thou sought.
* **Lighting** - the last two tiles inside the circle of sight are dimmed (by day too), the whole map takes on a blue tint at night and an orange-red one at sunrise and sunset.
* **Night road music** - travelling overland after dark plays a slow, gloomy theme in A minor (low drones, sparse notes, a dripping bell) instead of the daytime march; the daytime theme returns at dawn.
* **Night battles** - fights on the overworld after dark are tinted like the map (blue at night, orange-red at sunup and sundown) and the far side of the battlefield falls into shadow: the party sees clearly only about 7 tiles at night (14 by day; light spells help).
* **Bolder monsters at night** - between 20:00 and 04:59 roaming monsters notice a party from 40% further away, close in faster, and two more of them are kept around every adventurer with more frequent spawns; in a battle that begins after dark the foes hit +2 more often and for 20% more damage.
* **Night music in settlements** - towns, villages and castles play a slow lute nocturne in A minor after dark (the inn, the lord's hall and the sanctuary keep their own tunes).
* **Jukebox** - the JUKEBOX button next to MENU opens a floating player that plays any of the game's 18 tunes (previous / next / stop, progress bar, volume). It can be dragged, minimized and stays open over the game, playing until it is closed (or stopped), after which the regular music of the place returns.
* **Web host package** - `stargazerslegacyonline.zip` unzips straight into a folder of a web host (index.html at its root, `server/` beside it); see INSTALL.txt inside. `server/config.local.php` can hold the admin password on hosts without environment variables.
