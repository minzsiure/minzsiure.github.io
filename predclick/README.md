## PredClick

### Data storoage
* `audio_start_iso`: ISO string like "2026-01-05T15:23:10.123-05:00"
* `response_iso`: ISO string like "2026-01-05T15:23:12.401-05:00"
* `rt_ms`: reaction time in milliseconds from audio start → response
* `tL_s`: timing of left clicks
* `tR_s`: timing of right clicks
* `lam_pair`: [25,15] (lambda of left and right clicks)
* `lamL`, `lamR`: the randomized assignment used on that trial
* `correct_choice`: what the ground truth choice was
* `user_choice`: what user chose
* `success`: whether the trial is a success