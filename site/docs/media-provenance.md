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

Captured logged-out from the 12 most recent posts on Jake's public Instagram profile ([@jake_dedert_teamjd_coaching](https://www.instagram.com/jake_dedert_teamjd_coaching/)). Most are collaboration posts co-published with the client's own account. Images were taken from the public embed view at the largest size Instagram served (1080–1536px; one 3024px original). 13 frames were left out: unrelated or blurry shots, small crowd line-ups, and a photographer's watermarked promo poster. Reel and video slides were skipped. Not yet placed on any page.

- Permission basis: media published on, or co-published with, Jake's Team JD Coaching Instagram. Akhil (site owner) confirmed on 11 November 2026 that Jake has his clients' consent for website use.
- Photographer credit: most stage shots appear to be event or freelance photography (ICN South Australia / Nationals). Client consent does not cover photographer copyright; confirm a credit or licence with Jake before featuring them prominently.
- Accessed: 11 November 2026
- Transformations: source JPEGs re-encoded to WebP (quality 82, max width 2400px) with the Team JD asset optimiser; no crops or edits.
- Storage: R2 prefix `imports/instagram/2026-11-11/`. This sits outside `site-assets/` on purpose so `npm run rebuild-assets` does not purge it. The files are not in the asset manifest. Key naming: `jake-…` frames include Jake; `client-…` frames are clients only.

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
