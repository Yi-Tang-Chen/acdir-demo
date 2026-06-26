const steps = [
  25, 27, 48, 66, 108, 136, 138, 139, 144, 172, 177, 194, 224, 242, 243, 244,
];

const image = document.querySelector("#step-image");
const slider = document.querySelector("#step-slider");
const stepLabel = document.querySelector("#step-label");
const prevButton = document.querySelector("#prev-step");
const nextButton = document.querySelector("#next-step");
const playButton = document.querySelector("#play-pause");

let index = 0;
let timer = null;

function stepPath(step) {
  return `assets/steps/step_${String(step).padStart(3, "0")}.png`;
}

function render() {
  const step = steps[index];
  const padded = String(step).padStart(3, "0");
  image.src = stepPath(step);
  image.alt = `ACDiR generation step ${step}`;
  slider.value = String(index);
  stepLabel.textContent = `step ${padded}`;
}

function go(delta) {
  index = (index + delta + steps.length) % steps.length;
  render();
}

function stop() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  playButton.textContent = "Play";
  playButton.setAttribute("aria-label", "Play generation");
}

function play() {
  if (timer !== null) {
    stop();
    return;
  }
  playButton.textContent = "Pause";
  playButton.setAttribute("aria-label", "Pause generation");
  timer = window.setInterval(() => go(1), 1300);
}

prevButton.addEventListener("click", () => {
  stop();
  go(-1);
});

nextButton.addEventListener("click", () => {
  stop();
  go(1);
});

playButton.addEventListener("click", play);

slider.addEventListener("input", (event) => {
  stop();
  index = Number(event.target.value);
  render();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    prevButton.click();
  }
  if (event.key === "ArrowRight") {
    nextButton.click();
  }
  if (event.key === " ") {
    event.preventDefault();
    play();
  }
});

render();
