---
sidebar_position: 124
---

# Mixed Reality Map: Aiming a Phone at the Street

Labelling the world through a phone camera turned out to be three problems that all look
like one: knowing where the camera points, knowing what is out there, and drawing the answer
so it can be read. Each had a wrong first answer that seemed obviously right.

![Named places over the camera feed with street lines and the icon bar](/img/mixed-reality-map/labels.webp)

The camera starts off, which is the actual default rather than a stand-in for a screenshot: the
overlay reads the same way over the plain background it draws on here as it does over the live
feed a toggle can bring in behind it.

## The orientation angles lock in exactly the pose this needs

Device orientation arrives as three Euler angles, and the compass bearing looks like it is
simply the first of them. It is, but only while the device lies flat. Euler angles are
applied in sequence, and where two of the axes line up the pair stops describing two
independent rotations and starts describing one, so a change in either produces the same
motion and the difference between them is lost. For this ordering that happens at a quarter
turn of pitch.

A phone lying on a table is far from it. A phone held up to look through sits right on top of
it. So the naive heading is not merely imprecise for an aimed view, it is undefined for the
only pose the view is ever used in: the bearing stops responding to turning, and the roll
starts swinging the whole overlay instead.

The tilt controls had already met this once, from the other side, and answered it by working
from the direction of gravity rather than from the angles. The same answer generalises. The
three angles combine into one rotation, and every question worth asking is a direction read
off that rotation rather than an angle read off the inputs.

| Question                          | The direction that answers it                    |
| --------------------------------- | ------------------------------------------------ |
| Which way is the camera pointing? | The device's backward axis, in world coordinates |
| How far above the horizon?        | The vertical part of that same direction         |
| How far is the horizon turned?    | World up, projected onto the screen plane        |

None of the three has a discontinuity anywhere, so the same arithmetic holds face down, held
up, and rolled into landscape.

```mermaid
flowchart LR
  A["alpha, beta, gamma"] --> B["One rotation"]
  B --> C["Backward axis<br/>heading and pitch"]
  B --> D["World up on screen<br/>roll"]
  C --> E["Where a label goes"]
  D --> F["How far the layer turns"]
```

One platform difference survives this. WebKit reports a relative first angle and publishes
the absolute compass separately, where every other engine puts the absolute value in the
angle itself. Rather than branching downstream, the compass reading substitutes for the angle
before the rotation is built, which leaves a single path through the maths.

## Rotating the overlay is what makes it look fixed

The instinct is to hold the labels upright, the way a map's text stays upright. That is
exactly backwards. Upright text is painted on the glass and travels with the phone, and a
viewer reads it as an interface. Text that turns against the phone stays square to the
horizon, and a viewer reads it as part of the street.

Because every label turns by the same amount, the layer turns once rather than each label
being placed into an already-turned frame. That also keeps the placement arithmetic in a
frame where up is up.

The page must then not turn as well, or the same rotation happens twice. Locking the page to
portrait is the honest fix; where a platform ignores the lock, the rotation the browser
already applied is subtracted back out — but only when the page has visibly taken it. Some
browsers report the angle the device is held at rather than the one the document was turned
by, and believing that turns the overlay a quarter turn while the page is plainly still
portrait. The viewport's own shape is the check: a portrait viewport has not been rotated,
whatever the angle claims.

Two more ways to be spun a quarter turn by nothing, both of which took a phone to find. A
device lying flat has no horizon — the plumb line points straight through the screen — so its
roll is whichever way the last of the sensor noise fell, and it has to be held rather than
followed. And roll is an angle: blending it as a plain number sends the overlay the long way
round half a turn every time it crosses the wrap. Neither shows up on a desk, and both look
identical to the projection being wrong.

![The same labels with the phone rolled into landscape, turned against the still-portrait page](/img/mixed-reality-map/rolled.webp)

The page is still portrait in that shot. The phone has been rolled a quarter turn, and the
labels have turned the other way to stay square to the world.

## Everything on the horizon is everything in one place

Placing each name at its bearing and leaving the vertical alone puts every label on a single
line, where the near ones bury the far ones and a street of shops becomes an unreadable smear.
The first fix used an angle: something standing on the ground is genuinely below eye level, by
an angle that grows as it gets closer, and that angle separated a doorway two paces away from a
tower four streets back the way the eye already expects. It also meant a card's height on the
frame depended on the phone's pitch, which is exactly the axis a hand holding a phone cannot
hold still, so the whole picture breathed with every small tilt of the wrist.

Every card now starts on the same fixed row regardless of distance, and separation is left
entirely to what shares a column with it: a card sharing a column with one already placed is
pushed up by the actual height of that stack rather than a guessed step, so a several-tenant
card pushes the next one further than a single row would. Nearest first, so the closest card
keeps the base row and the ones pushed clear are the ones already reading as further away. The
ground marker that used to carry a shop's true, distance-shrunk position is gone along with the
elevation it depended on; a building icon on the card is what says what kind of thing it is now.

## The obvious map API is the one that does not answer

Overpass is the standard way to ask OpenStreetMap what is nearby, and it is the right query
language for it. Its public mirrors are also a shared free service under permanent load, and
during this work every mirror tried returned a gateway timeout or a busy page — sometimes as
an HTML error body under a success status, which is its own trap for a parser.

A reverse geocoder answers a narrower question, which is the only question this view has:
what is around this point. Komoot's is free, needs no key, sends an open cross-origin header,
and replies in under a second. The narrower service being both faster and more reliable is
the usual shape of this trade, and worth reaching for before the general one.

Its answers still need filtering. A city, a county and a postcode all come back with a
position, but that position is wherever the centre happened to be drawn, so labelling them
puts a city's name on one arbitrary building. Names repeat too, because a square, the footway
across it and the cycleway along it are three features sharing one name.

The one thing it cannot answer is geometry. A reverse geocoder returns a street as a single
point, and a street drawn on the ground needs the whole chain of nodes it runs through, so the
centre lines do come from Overpass after all — a much smaller question than the original one,
named roads only.

One endpoint was not enough. Over the course of this work the public mirrors variously answered
502, 504, 500, an HTML error page under a success status, and nothing at all, and a single
endpoint means no streets whenever that one is having a bad minute. Several are now tried in
turn, and anything that will not parse as the expected shape counts as a failure and moves on,
because a busy mirror does not reliably say so in its status code.

Failing quietly was its own bug. The lines simply did not appear, which is indistinguishable
from a projection that is wrong, and cost two rounds of looking in the wrong place. A slow
answer now says it is loading and a failed one says what went wrong and offers to try again —
worth far more here than another attempt at making the fetch succeed.

Those lines then want a far shorter radius than the labels. From standing height the ground
falls away fast: a street two hundred metres off sits half a degree below the horizon, and
every street past that piles into the same few pixels of it. Drawing more of them adds a smear
rather than information.

A line was also the wrong shape to draw them with, for as long as pitch decided where on the
frame a street sat: a stroke has a width in pixels, so it stays the same thickness however far
away it runs, and read as a wire strung across the picture rather than as ground. Projecting
both kerbs from the road's real width into a surface that narrowed into the distance fixed
that. Dropping pitch from the projection later dropped the reason for the surface along with
it: a street swept purely by compass heading has no distance left to narrow into, so it is a
line again, this time because there is nothing left for a surface to draw. The shop marker went
the same way in reverse: it used to be a box sized to a real shopfront so it would shrink with
distance, and once distance no longer decided its position either, that box became a building
icon on the card carrying the name, rather than a separate mark on the ground.

## Calibration is not optional

No browser reports the camera's field of view, and it differs by device. It is also the one
number that decides whether a label sits on the building it names, so it is a control rather
than a constant. The compass gets the same treatment: magnetometers read off, some Android
builds never report an absolute bearing at all, and a desktop has no sensor whatsoever. A
heading offset covers all three, and doubles as the only way to look around on a machine that
cannot be turned.

![A tapped place with its picture, beside the plan view in the corner](/img/mixed-reality-map/detail.webp)

Which kinds of thing are named is a row of icon toggles along the bottom rather than a setting
behind a button, because it is the control that gets used while walking: a street of shops is a
wall of names, and turning four of the five kinds off is how you find the one you wanted.

## The map is drawn, not fetched

A plan view in the corner is the obvious place to reach for map tiles, and the wrong one. The
street geometry is already loaded to draw the overlay's lines, and the places are already loaded
to label them, so the plan is a second projection of data the view is holding anyway: no key to
carry, no usage policy to honour, nothing to fetch, and no way for the map to disagree with the
labels, because it is the same data seen from above.

It is turned so the way you are facing points up, rather than north. North-up is the convention
and it is wrong here: the whole purpose is to line the plan up with what the camera is showing,
and a map you have to rotate in your head does not do that. The view cone is the one thing on it
that does not turn, because it belongs to the screen rather than to the ground.

Pictures come from Wikipedia's search by position, which is free and keyless like everything
else here. It answers with the nearest article that has a photograph, and for an ordinary shop
that is usually the street or the district rather than the shop itself — so the card names the
article it took the picture from. A photograph presented as the place, when it is really the
neighbourhood, would be the kind of small lie that makes the rest untrustworthy.
