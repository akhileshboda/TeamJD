# Media provenance

This file records externally sourced media used by the Team JD website. Runtime assets are stored in Dropbox as the source library, optimized by the asset sync, and served from the Team JD Cloudflare R2 custom domain through `/api/assets` mappings.

## Personal Training

### Form First Studio venue gallery

- Source: [Form First Studio](https://www.formfirststudio.com.au/), official venue photography.
- Permission basis: Form First Studio approved Team JD to download, optimise, and publish the selected venue photographs on the Personal Training service page.
- Accessed: 12 August 2026.
- Transformations: official JPEGs optimised to WebP by the Team JD asset pipeline; responsive CSS crops only.
- Placement: `/services/personal-training`, “Train at Form First” venue gallery.

| Asset key | Official source image | Description | Runtime mapping |
| --- | --- | --- | --- |
| `form-first-thebarton-training-floor` | [Training floor](https://cdn.prod.website-files.com/67a9fd92004b28a0a0ce2ac1/690c42cf044310c6bd119322_Form-First-Private-Gym-Memberships-08.jpg) | Wide training-floor view with machines, benches, and dumbbells | `site-assets/services/form-first-thebarton-training-floor.webp` |
| `form-first-thebarton-machine-floor` | [Machine floor](https://cdn.prod.website-files.com/67a9fd92004b28a0a0ce2ac1/690c41ebd76930d13e5af21b_Form-First-Private-Gym-Memberships-01.jpg) | Strength-machine and free-weight area | `site-assets/misc/form-first-thebarton-machine-floor.webp` |
| `form-first-thebarton-strength-space` | [Strength space](https://cdn.prod.website-files.com/67a9fd92004b28a0a0ce2ac1/690c42553ffc5174c6579b5b_Form-First-Private-Gym-Memberships-05.jpg) | Squat racks, plates, benches, and mirror wall | `site-assets/misc/form-first-thebarton-strength-space.webp` |

## Contact page

### Cinematic athlete training reel

- Current embed: [You Can’t Stop Us | Nike](https://www.youtube.com/watch?v=GbQomqb28os)
- Publisher credited by YouTube: NIKE JAPAN
- Use basis: official YouTube privacy-enhanced embed only; the video is not downloaded, modified, or rehosted by Team JD
- Accessed: 22 July 2026
- Placement: `/contact`, “Explore the Work”; muted presentation with a linked on-frame credit

### Cinematic reel fallback poster

- Asset keys: `contact-athlete-reel`, `video-contact-athlete-reel-poster`
- Source: [Cinematic Athlete Training in Dim Gym](https://www.pexels.com/video/cinematic-athlete-training-in-dim-gym-34583326/)
- Creator: JULLIAN PRODUCTION
- License basis: [Pexels media license](https://www.pexels.com/license/), including use on commercial websites and modification
- Accessed: 21 July 2026
- Transformations: first eight seconds; H.264 MP4; maximum width 1080px; 30fps; audio removed; fast-start enabled; poster captured at 2.5 seconds and optimized to WebP
- Placement: `/contact`, poster fallback for mobile, reduced-motion, save-data, or embed failure
- Runtime mapping: `site-assets/video/contact-athlete-reel.mp4` and `site-assets/video/video-contact-athlete-reel-poster.webp`

### Jake training progress photo

- Asset key: `gallery-jake-training-facebook-2019`
- Source: [Jake Dedert Facebook photo, 26 February 2019](https://www.facebook.com/photo.php?fbid=363234144272895)
- Creator/owner: Jake Dedert
- License basis: Jake-created, Jake-only media authorised by the site owner for Team JD commercial website use
- Accessed: 21 July 2026
- Transformations: source JPEG optimized to WebP by the Team JD asset pipeline
- Placement: `/contact`, “Follow the Work” social gallery
- Runtime mapping: `site-assets/gallery/gallery-jake-training-facebook-2019.webp`

### Jake off-duty portrait

- Asset key: `gallery-jake-off-duty-facebook-2019`
- Source: [Jake Dedert Facebook photo, 16 March 2019](https://www.facebook.com/photo.php?fbid=370510040211972)
- Creator/owner: Jake Dedert
- License basis: Jake-created, Jake-only media authorised by the site owner for Team JD commercial website use
- Accessed: 21 July 2026
- Transformations: source JPEG optimized to WebP by the Team JD asset pipeline
- Placement: `/contact`, “Follow the Work” social gallery
- Runtime mapping: `site-assets/gallery/gallery-jake-off-duty-facebook-2019.webp`

### Recent public Facebook rail

The public Instagram profile returned “Profile isn’t available” when checked on 22 July 2026, so no Instagram media was copied or represented as current. The seven-item carousel uses the newest ordered photo entries exposed by Jake’s public Facebook page at that access time. Each card links back to its source post.

| Asset key | Source post | Published | Description | Runtime mapping |
| --- | --- | --- | --- | --- |
| `gallery-social-facebook-stage-2022` | [Facebook photo 490737829725503](https://www.facebook.com/photo/?fbid=490737829725503) | 16 August 2022 | Jake with another physique competitor on stage | `site-assets/gallery/gallery-social-facebook-stage-2022.webp` |
| `gallery-social-facebook-editorial-2022` | [Facebook photo 490737826392170](https://www.facebook.com/photo/?fbid=490737826392170) | 16 August 2022 | Industrial-location physique editorial, visibly credited in the source image to Nelson Azevedo | `site-assets/gallery/gallery-social-facebook-editorial-2022.webp` |
| `gallery-social-facebook-coaching-2020` | [Facebook photo 733438047252501](https://www.facebook.com/photo/?fbid=733438047252501) | 1 November 2020 | Jake with two competitors at an ICN South Australia event | `site-assets/gallery/gallery-social-facebook-coaching-2020.webp` |
| `gallery-social-facebook-training-detail-2019` | [Facebook photo 383852782211031](https://www.facebook.com/photo/?fbid=383852782211031) | 16 April 2019 | Side-profile training detail | `site-assets/gallery/gallery-social-facebook-training-detail-2019.webp` |
| `gallery-social-facebook-studio-portrait-2019` | [Facebook photo 375585383037771](https://www.facebook.com/photo/?fbid=375585383037771) | 28 March 2019 | Studio physique portrait | `site-assets/gallery/gallery-social-facebook-studio-portrait-2019.webp` |
| `gallery-social-facebook-gym-2019` | [Facebook photo 373422239920752](https://www.facebook.com/photo/?fbid=373422239920752) | 23 March 2019 | Jake among strength equipment in a gym | `site-assets/gallery/gallery-social-facebook-gym-2019.webp` |
| `gallery-jake-off-duty-facebook-2019` | [Facebook photo 370510040211972](https://www.facebook.com/photo/?fbid=370510040211972) | 16 March 2019 | Off-duty mirror portrait; existing mapped asset reused | `site-assets/gallery/gallery-jake-off-duty-facebook-2019.webp` |

- Creator/owner basis: media published on Jake Dedert’s Team JD Coaching page and selected by the site owner for reuse; the editorial image retains its visible original creator credit
- Accessed: 22 July 2026
- Transformations: source JPEGs optimized to WebP by the Team JD asset pipeline; presentation uses non-destructive CSS crops
- Placement: `/contact`, looping “Follow the Work” carousel

## Instagram import (11 November 2026)

### Jake and client competition photos

Captured logged-out from the 12 most recent posts on Jake's public Instagram profile ([@jake_dedert_teamjd_coaching](https://www.instagram.com/jake_dedert_teamjd_coaching/)). Most are collaboration posts co-published with the client's own account. Images were taken from the public embed view at the largest size Instagram served (1080–1536px; one 3024px original). 13 frames were left out: unrelated or blurry shots, small crowd line-ups, and a photographer's watermarked promo poster. Reel and video slides were skipped. Since 12 November 2026 all 52 photos are copied into each environment's media library, and seven of them are published as competitor results (see `server/seed/instagram-import.json`).

- Permission basis: media published on, or co-published with, Jake's Team JD Coaching Instagram. Akhil (site owner) confirmed on 11 November 2026 that Jake has his clients' consent for website use.
- Photographer credit: most stage shots appear to be event or freelance photography (ICN South Australia / Nationals). Client consent does not cover photographer copyright; confirm a credit or licence with Jake before featuring them prominently.
- Accessed: 11 November 2026
- Transformations: source JPEGs re-encoded to WebP (quality 82, max width 2400px) with the Team JD asset optimiser; no crops or edits.
- Storage: R2 prefix `imports/instagram/2026-11-11/`. This sits outside `site-assets/` on purpose so `npm run rebuild-assets` does not purge it. The files are not in the asset manifest; each environment's media library holds its own copy under `cms/<environment>/`. Key naming: `jake-…` frames include Jake; `client-…` frames are clients only.

| Source post | Account | Published | Frames kept | R2 keys |
| --- | --- | --- | --- | --- |
| [DLeKELayUP1](https://www.instagram.com/p/DLeKELayUP1/) | @jake_dedert_teamjd_coaching | 28 June 2025 | 7 | `jake-teamjd-2025-06-28-01.webp`, `client-teamjd-2025-06-28-02.webp`, `jake-teamjd-2025-06-28-03.webp`, `client-teamjd-2025-06-28-04.webp`, `client-teamjd-2025-06-28-05.webp`, `client-teamjd-2025-06-28-06.webp`, `client-teamjd-2025-06-28-07.webp` |
| [DetPSabknZp](https://www.instagram.com/p/DetPSabknZp/) | @its.bmitch | 19 October 2026 | 4 | `client-its-bmitch-2026-10-19-01.webp`, `client-its-bmitch-2026-10-19-02.webp`, `client-its-bmitch-2026-10-19-03.webp`, `client-its-bmitch-2026-10-19-07.webp` |
| [DejQYwKnUI4](https://www.instagram.com/p/DejQYwKnUI4/) | @sezthebezt | 16 October 2026 | 3 | `client-sezthebezt-2026-10-16-01.webp`, `client-sezthebezt-2026-10-16-02.webp`, `client-sezthebezt-2026-10-16-04.webp` |
| [DejMVx3lK4H](https://www.instagram.com/p/DejMVx3lK4H/) | @gabidollar | 16 October 2026 | 6 | `client-gabidollar-2026-10-16-01.webp`, `client-gabidollar-2026-10-16-02.webp`, `client-gabidollar-2026-10-16-03.webp`, `client-gabidollar-2026-10-16-04.webp`, `client-gabidollar-2026-10-16-05.webp`, `client-gabidollar-2026-10-16-06.webp` |
| [DeVlqe7EvM5](https://www.instagram.com/p/DeVlqe7EvM5/) | @ethan___lifts | 10 October 2026 | 2 | `jake-with-ethan-lifts-2026-10-10-01.webp`, `jake-with-ethan-lifts-2026-10-10-02.webp` |
| [DePiHkOE5Tw](https://www.instagram.com/p/DePiHkOE5Tw/) | @sezthebezt | 8 October 2026 | 5 | `client-sezthebezt-2026-10-08-01.webp`, `client-sezthebezt-2026-10-08-02.webp`, `client-sezthebezt-2026-10-08-03.webp`, `client-sezthebezt-2026-10-08-04.webp`, `client-sezthebezt-2026-10-08-05.webp` |
| [DeOV3QLnRHr](https://www.instagram.com/p/DeOV3QLnRHr/) | @gabidollarfit | 7 October 2026 | 7 | `client-gabidollarfit-2026-10-07-01.webp`, `jake-with-gabidollarfit-2026-10-07-02.webp`, `client-gabidollarfit-2026-10-07-03.webp`, `client-gabidollarfit-2026-10-07-04.webp`, `client-gabidollarfit-2026-10-07-06.webp`, `client-gabidollarfit-2026-10-07-07.webp`, `client-gabidollarfit-2026-10-07-08.webp` |
| [DeGkFsdEnCU](https://www.instagram.com/p/DeGkFsdEnCU/) | @ethan___lifts | 4 October 2026 | 4 | `client-ethan-lifts-2026-10-04-01.webp`, `client-ethan-lifts-2026-10-04-02.webp`, `client-ethan-lifts-2026-10-04-03.webp`, `client-ethan-lifts-2026-10-04-04.webp` |
| [DSe32dEic0c](https://www.instagram.com/p/DSe32dEic0c/) | @rachelaccadia | 20 December 2025 | 10 | `jake-with-rachelaccadia-2025-12-20-01.webp`, `client-rachelaccadia-2025-12-20-02.webp`, `client-rachelaccadia-2025-12-20-03.webp`, `client-rachelaccadia-2025-12-20-04.webp`, `client-rachelaccadia-2025-12-20-05.webp`, `client-rachelaccadia-2025-12-20-07.webp`, `client-rachelaccadia-2025-12-20-08.webp`, `client-rachelaccadia-2025-12-20-09.webp`, `client-rachelaccadia-2025-12-20-10.webp`, `client-rachelaccadia-2025-12-20-11.webp` |
| [DPBobfZEu8s](https://www.instagram.com/p/DPBobfZEu8s/) | @jake_dedert_teamjd_coaching | 25 September 2025 | 4 | `jake-teamjd-2025-09-25-01.webp`, `client-teamjd-2025-09-25-02.webp`, `client-teamjd-2025-09-25-03.webp`, `client-teamjd-2025-09-25-04.webp` |

## Instagram import (12 November 2026)

### Client transformation and everyday-client stories

Screenshots of Jake's "Client Wins" story highlight on [@jake_dedert_teamjd_coaching](https://www.instagram.com/jake_dedert_teamjd_coaching/). Captured with a local Playwright browser after Akhil signed in to Instagram himself, because highlights aren't visible to logged-out visitors. The stories are Jake's reposts of clients' own stories, mostly from 2020–2023. The logged-in grid (341 posts) was also checked; it has no client transformations beyond the posts already imported on 11 November.

Each frame was screenshotted at 3× pixel density and then cropped by hand. The crops remove Instagram's story header, the reposted account's avatar and handle, and the reply bar. They keep the client's own story text and stickers where those carry the result (for example "4 weeks progress" or the before/after numbers). Handle stickers are cropped out too (Brooke's 4-week frame loses its "@brooke.monjean, 4 weeks progress" sticker; the 4 weeks is recorded below). Krissy's PB frame is cropped below a sweary sticker and a gym tag. Akhil's frame is cropped above the PIC·COLLAGE watermark.

Left out on purpose:
- "Lost 18kg over 13 weeks" (@massimo_conci): the numbers are in a sweary caption, and once that is cropped out nothing in the photo shows the result or links it to Team JD.
- Competition progress collages and placings: the 11 November import already covers competitors.
- The Team JD logo card.
- The other highlights (Team Girls, Season A 2024 and so on).

- Permission basis: as for the 11 November import. These are Jake's own highlight reposts of clients' stories, and Akhil confirmed on 11 November 2026 that Jake has his clients' consent for website use. Akhil asked for his own before/after to be included (12 November 2026).
- Accessed: 12 November 2026
- Transformations: the hand crops described above, then re-encoded to WebP with the Team JD asset optimiser. The `-v2`/`-v3` suffixes mark later, tighter crops; superseded versions were deleted from R2.
- Storage: R2 prefix `imports/instagram/2026-11-12/`, outside `site-assets/`. `transformation-…` frames show body-composition change and `everyday-…` frames show strength or health wins. Each environment copies them into its own media library on start (`server/seed/instagram-import.json`).

| Story (Client Wins, frame) | Client (as tagged) | Story text | R2 key | Used as |
| --- | --- | --- | --- | --- |
| 14 | not tagged (Team JD graphic) | Before 67kg / after 55kg | `transformation-client-wins-01-v2.webp` | Transformation result |
| 12 | handle cropped | Day 1 vs Day 75; 4.7kg in 75 days, 6.2kg in total | `transformation-client-wins-03-v2.webp` | Transformation result |
| 17 | @its_missfit | January 2023 vs June 2023, "getting shredded and shaping up slowly" | `transformation-client-wins-04-v3.webp` | Transformation result |
| 4 | @brooke.monjean | 4 weeks progress | `transformation-brooke-client-wins-05-v3.webp` | Transformation result |
| 6 | @brooke.monjean | 5 weeks down (caption cropped) | `transformation-brooke-client-wins-06-v2.webp` | Media library only |
| 9 | @alanahkmcc | First 120kg hip thrusts since a back injury | `everyday-client-wins-07-v3.webp` | Everyday result |
| 7 | @krissystoutley | 7 new personal bests | `everyday-krissy-client-wins-08-v3.webp` | Everyday result |
| 11 | @alanahkmcc | 4kg down and muscle gain | `everyday-client-wins-09-v2.webp` | Media library only |
| 18 | @akhilboda00 | "Client's insane level transformation" (caption cropped) | `transformation-akhil-client-wins-10-v2.webp` | Transformation result |

## Instagram import, round 2 (12 November 2026)

### More competitors, transformations and everyday clients

Captured from Jake's story highlights with a local browser after Akhil signed in himself. The highlights were Comp Clients, ICN SA Season B 2024, ICN Nationals 2024, ICN SA Season B 2026, Season A 2024 and Life. A logged-in pass over the Tagged tab found only 10 old posts, nearly all of Jake himself from 2017. The Life highlight and the last highlight (energy drink reviews) hold no client results. Jade's photo comes from Jake's own post [DO0tLpYEsZa](https://www.instagram.com/p/DO0tLpYEsZa/), and Maxine's from her post [DKB8a81J-7Z](https://www.instagram.com/p/DKB8a81J-7Z/), which tags Jake as her coach.

Each frame was screenshotted at 3× pixel density and hand-cropped. The crops remove Instagram's header, avatar and handle, reply bar and carousel arrows, but keep Jake's or the client's own caption where it states the result. Names in captions are first names only.

Every placing and number in the result copy comes from text in the frame, the client's own post caption, or Jake's story text. The sources are listed below.

- Permission basis: as for the 11 November import (Akhil confirmed Jake has his clients' consent for website use).
- Accessed: 12 November 2026
- Storage: R2 prefix `imports/instagram/2026-11-12-round2/`, copied into each environment's media library on start (`server/seed/instagram-import.json`, batch `instagram-2026-11-12-round2`).

| Source | Client | What it shows / states | R2 key | Used as |
| --- | --- | --- | --- | --- |
| ICN SA Season B 2024 highlight | Gabriel (Gabriel Pepe) | "Bikini Novice Class 2 Winner"; other frames: Swimsuit 1st, Bikini Open Class 2 1st | `competitor-gabriel-sznb-2024.webp` | Competitor result |
| ICN SA Season B 2024 highlight | Sophie (Sophie Holtham) | "Wellness Open Class 1 2nd Place"; another frame: 2nd in themewear | `competitor-sophie-sznb-2024.webp` | Competitor result |
| Post DO0tLpYEsZa (Jake) | Jade | 1st Bikini and pro card at FMG Worlds, Gold Coast; 3rd at FMG NZ two weeks earlier | `competitor-jade-fmg-worlds-v2.webp` | Competitor result |
| Post DKB8a81J-7Z (Maxine) | Maxine | Debut, overall 2025 Miss Bikini State Champion, qualified for Nationals and pro league | `competitor-maxine-state-2025-v2.webp` | Competitor result |
| Comp Clients highlight | Shari (@shari_shafit) | Her caption: Season B November 2020 vs Season A April 2018 @icn_sa (the photos carry no dates, so the copy does not say which is which); other frames: 1st Figure Novice ICN Nationals | `transformation-shari-2018-2020-v2.webp` | Transformation result |
| Comp Clients highlight | @sbarbarblacksheep | "1 year ago" stage shot above a later back pose | `transformation-sbarbarblacksheep-1-year-v2.webp` | Transformation result |
| Client Wins highlight | Krissy (@krissystoutley) | "In prep vs now, we growin'" | `transformation-krissy-prep-vs-now-v2.webp` | Transformation result |
| Client Wins highlight | Brooke (@brooke.monjean) | "5 weeks down and amazing changes" | `everyday-brooke-5-weeks.webp` | Everyday result |
| Client Wins highlight | Massimo (@massimo_conci) | "September 18, Summer inbound, 1.3kg down" | `everyday-massimo-summer-inbound.webp` | Everyday result |

Facts added to the existing results, from the same sources:
- Ethan: 22 weeks, Men's Physique First Timer 1st, Novice 2nd, Open 4th and Classic Physique 3rd (his post DeGkFsdEnCU).
- Gabi: overall Ms Swimsuit SA 2026 (her post DeOV3QLnRHr).
- Rachel: Wellness and Sports overall winner (her post DSe32dEic0c).
- Ben: Men's Physique Under 23 winner and Classic Physique Open 2 3rd (Jake's ICN SA Season B 2026 highlight). His photo is from his own post, and the copy does not say it was taken at that show.
- Matt (the 25 September 2025 post): 1st Open Middle Weight and 3rd True Novice at his first IFBB show (Jake's post DPBobfZEu8s).
- Nationals 2025: the three-athlete summary comes from Jake's post DLeKELayUP1.
- Testimonial quotes: from Sarah's, Ethan's, Rachel's, Jade's and Maxine's own posts.

Coverage: Instagram is the only source for results at this stage (decided 12 November 2026). Across every highlight and post checked there are 8 transformation results and 4 everyday-client results. Brooke and Krissy each appear in both groups because no other non-competitor clients are posted. Competitors have 13 results from 12 people.

### Akhil's own stage photos

Four of the six original "client" stage results were photos of Akhil, and two of those were the same photo (`client-comp-1`, `client-comp-2`, `client-comp-4`, `ab-posing`). They are now hidden, not deleted. The seed marks them `hidden`, and a one-off migration unpublishes the live version in existing stores wherever it still shows Akhil's original photo, even if its words were edited. A version whose photo Jake swapped is left alone. The kept two, `client-posing-1` (gold at ANB) and `client-comp-3` (kneeling pose), have a new caption, headline and summary, replaced only where the old seed wording was still in place. Akhil confirmed their testimonial quotes are his own words (12 November 2026). Their made-up lengths (16 and 8 weeks), stat chips (for example "Confidence: Higher") and anonymous testimonial labels were removed at Akhil's request (12 November 2026). The testimonials are now credited to Akhil, and the migration makes the same change in existing stores wherever the old seed value is still in place.
