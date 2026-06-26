const steps = [
  25, 27, 48, 66, 108, 136, 138, 139, 144, 172, 177, 194, 224, 242, 243, 244,
];

const image = document.querySelector("#step-image");
const slider = document.querySelector("#step-slider");
const currentStep = document.querySelector("#current-step");
const stepNumber = document.querySelector("#step-number");
const prevButton = document.querySelector("#prev-step");
const nextButton = document.querySelector("#next-step");

let index = 0;

function stepPath(step) {
  return `assets/steps/step_${String(step).padStart(3, "0")}.png`;
}

function render() {
  const step = steps[index];
  image.src = stepPath(step);
  image.alt = `ACDiR intervention panel at diffusion step ${step}`;
  slider.value = String(index);
  currentStep.textContent = `step ${String(step).padStart(3, "0")}`;
  stepNumber.textContent = String(step);
}

prevButton.addEventListener("click", () => {
  index = (index + steps.length - 1) % steps.length;
  render();
});

nextButton.addEventListener("click", () => {
  index = (index + 1) % steps.length;
  render();
});

slider.addEventListener("input", (event) => {
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
});

render();
