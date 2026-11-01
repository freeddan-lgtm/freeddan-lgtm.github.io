# Playing real band recordings in Agent World (with permission)

Yes, this can be done. If bands you know give written permission, their real recordings can play on the stages. The app is ready for it: add the track to `data/licensed-music.json` and put the file in `music/`.

*This is practical guidance, not legal advice. Before anything public or paid, have a music lawyer look at it.*

## Who has to say yes
A recording carries **two separate rights**, and you need permission for both:
1. **The sound recording (the "master").** This belongs to whoever owns the recording, usually the band or their label. Live recordings made by the band's own crew usually belong to the band.
2. **The song (the "composition").** This belongs to the songwriters and their **publisher**. If the band wrote the song and administers its own publishing, the band can grant this too. A cover song needs the original writer's publisher.

Also check two more things:
- **Public performance (streaming to the public).** Many songwriters have signed their performance rights to a collecting society (ASCAP, BMI, SESAC in the US; PRS, SOCAN and others elsewhere). In that case the band's own "yes" may not cover public streaming, and the site may need a performance licence. Ask the band's manager whether their songs are registered with one.
- **Fan or audience tapes.** Many jam bands allow non-commercial taping and *trading*. Streaming the tape inside an app is a different use, so ask about it specifically. The taper may also want credit.

## What the permission should say
Use something like the letter below. An email reply that clearly says "yes" to each point is a good record. Save it in a `permissions/` folder.

> Hi [Band / manager],
> I run **Agent World** (https://agent-world-shows.vercel.app), a free 3D fan space for jam-band shows. I'd love to play your recording(s) on our virtual stage.
> **Recording(s):** [title, date, venue, source]
> **Use:** streamed inside Agent World only, in full quality, with no downloads offered. [Non-commercial / no ads.]
> **Credit shown:** "[Band] · [title] · used with permission"
> **Duration:** [until you ask us to remove it / until DATE]. We'll take it down within [7] days of a request.
> Could you confirm that you control the rights to (a) this recording and (b) the songs, or tell us who else we should ask (label, publisher, collecting society)?
> Thank you! — Daniel

## Add the track to Agent World
1. Put the file in `music/`. FLAC or WAV keep it lossless.
2. Copy the `_example` block in `data/licensed-music.json` into `tracks`, then fill in `stage`, `title`, `artist`, `url` and every `license` field.
3. The track loads the first time a listener turns sound on, plays on that stage in 3D, and shows the credit and permission line in the stage panel. If `grantedBy`, `date` or `scope` is missing, the track is ignored (Rule A5).

Large FLAC files can hit your host's file-size limits, so check them. The browser plays the file in 32-bit float. It resamples to 48 kHz if the file's rate differs, and the player says when it does.
