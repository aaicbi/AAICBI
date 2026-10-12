/** Whether the person has turned the sound on during this visit. Later videos then start with sound, as they asked, without another tap. */
let soundOn = false;
export const isSoundOn = () => soundOn;
export const setSoundOn = (on: boolean) => { soundOn = on; };
