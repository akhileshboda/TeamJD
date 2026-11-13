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

## Instagram imports (November 2026)

Client competition photos, transformation stories and everyday-client wins were imported from Jake's Team JD Coaching Instagram (posts, collaboration posts co-published with clients, and Jake's story highlights) in three batches on 11–12 November 2026. Clients are not named in this public record; the client-facing copy uses first names only.

- Permission basis: media published on, or co-published with, Jake's Team JD Coaching Instagram, or reposted by Jake in his own story highlights. The site owner confirmed on 11 November 2026 that Jake has his clients' consent for website use.
- Photographer credit: some stage shots are event or freelance photography. Client consent does not cover photographer copyright; confirm a credit or licence with Jake before featuring them prominently.
- Accessed: 11–12 November 2026.
- Selection: unrelated, blurry, watermarked or unattributable frames were left out, as were frames whose result could not be verified from the image, the client's own caption or Jake's text.
- Transformations: screenshots or source JPEGs, hand-cropped to remove Instagram chrome, account handles and avatars, then re-encoded to WebP with the Team JD asset optimiser. `-v2`/`-v3` suffixes mark later, tighter crops; superseded versions were deleted from storage.
- Accuracy: every placing or number in result copy comes from text in the frame, the client's own post caption, or Jake's own text.
- Storage: R2 prefixes under `imports/instagram/`, outside `site-assets/` so `npm run rebuild-assets` does not purge them. They are not in the asset manifest; each environment copies them into its own media library on start. The per-frame source posts and keys are recorded in `server/seed/instagram-import.json` and in the private project records.

### Site owner's own stage photos

Four of the six original "client" stage results were photos of the site owner, two of them the same photo (`client-comp-1`, `client-comp-2`, `client-comp-4`, `ab-posing`). They are hidden, not deleted: the seed marks them `hidden`, and a one-off migration unpublishes the live version in existing stores wherever it still shows the original photo. The kept two (`client-posing-1`, `client-comp-3`) have new copy, and their testimonials are credited to the site owner at the owner's request (12 November 2026).
