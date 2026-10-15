import {
  waitingExpEndRoom,
  waiitingRoom,
} from "../Content/Forms/waitingRoom.js";
import {
  consentFormHTML,
  participantInfoHTML,
} from "../Content/Forms/consentForm.js";
import {
  instructionsHTML,
  sendMessage,
  practiceInstructionsHTML,
  addWaitingMessage,
} from "../Content/Forms/instructions.js";
import Game from "./Game.js";
const connectingHTML = `<div style="text-align: center;">
<h2>Connecting</h2>
<p>
	connecting......<br>
</p>
</div>
`;
let id = "";
let platform = "";
let lastPing = "";
let GameTimeout;
document.addEventListener("DOMContentLoaded", () => {
  let mainDiv = document.getElementById("main");
  attachEventListeners();
  mainDiv.innerHTML = connectingHTML;
  const wsURL = `ws://${window.location.host}${window.location.pathname}coms`;
  const ws = new WebSocket(wsURL);
  console.log("Connecting to the server...");
  let game = null;
  const defaultWsOnMessage = (event) => {
    let message = JSON.parse(event.data);
    console.log(message);
    switch (message.stage) {
      case "ping":
        ws.send(JSON.stringify({ stage: "ping" }));
        break;
      case "waitingRoom":
        loadWaitingRoom("main", ws);
        break;
      case "waitingExpEndRoom":
        loadWaitingExpEndRoom("main", ws);
        break;
      case "intro":
        switch (message.type) {
          case "consentForm":
            handleTimer();
            console.log(GameTimeout);
            loadConsentForm("main", ws);
            break;
          case "instructions":
            loadInstructions("main", ws);
            break;
        }
        break;
      case "practice":
        detachEventListeners();
        clearTimeout(GameTimeout);
        game = new Game(
          "main",
          ws,
          "practice",
          "sep",
          id,
          origin,
          message.inProgress,
          message.progress,
          message.state,
        );
        break;
      case "game":
        game = new Game("main", ws, "game", message.block);
        break;
    }
  };

  ws.onopen = () => {
    console.log("Connected to the server");
    const queryParams = new URLSearchParams(window.location.search);
    console.log(queryParams);
    if (queryParams.has("survey_code")) {
      id = queryParams.get("survey_code");
    } else {
      id = "";
    }
    if (queryParams.has("origin")) {
      origin = queryParams.get("origin");
    } else {
      origin = "";
    }
    let infoData = { id: id, origin: origin };
    ws.send(
      JSON.stringify({
        stage: "intro",
        type: "participantInfo",
        data: infoData,
      }),
    );
  };

  ws.onmessage = defaultWsOnMessage;
});
function handleIdlePlayer(origin) {
  if (origin === "Prolific") {
    window.location.replace(
      "https://app.prolific.com/submissions/complete?cc=",
    );
  } else if (origin === "SONA") {
    window.location.replace(
      `https://newcastle.sona-systems.com/webstudy_credit.aspx?experiment_id=1754&credit_token=ae4e2ac4b9aa43e6ac66289fe0a48998&survey_code`,
    );
  }
}
function handleTimer() {
  console.log(GameTimeout);
  clearTimeout(GameTimeout);
  GameTimeout = setTimeout(() => handleIdlePlayer(origin), 5 * 1000 * 60);
}
let data = {};
const attachEventListeners = () => {
  window.addEventListener("mousemove", handleTimer);
  window.addEventListener("click", handleTimer);
  window.addEventListener("keydown", handleTimer);
};

// Detach event listeners
const detachEventListeners = () => {
  console.log("removing event listeners");
  window.removeEventListener("mousemove", handleTimer);
  window.removeEventListener("click", handleTimer);
  window.removeEventListener("keydown", handleTimer);
};
function loadConsentForm(targetElementId, ws) {
  const targetElement = document.getElementById(targetElementId);
  if (targetElement) {
    targetElement.innerHTML = "";
    targetElement.innerHTML = consentFormHTML;

    const checkbox = document.getElementById("consent_checkbox");
    const startButton = document.getElementById("start");

    startButton.addEventListener("click", () => {
      if (checkbox.checked) {
        // Load participant information form
        targetElement.innerHTML = participantInfoHTML;

        // Call the function to handle the participant information form
        displayInfoHTML(targetElementId, ws);
      } else {
        console.log("Please check the consent checkbox before proceeding.");
      }
    });

    // Initially disable the start button if the checkbox is not checked
    startButton.disabled = !checkbox.checked;

    checkbox.addEventListener("change", () => {
      startButton.disabled = !checkbox.checked;
    });
  } else {
    console.error(`Target element with ID '${targetElementId}' not found.`);
  }
}
async function displayInfoHTML(targetElementId, ws) {
  const targetElement = document.getElementById(targetElementId);
  if (targetElement) {
    const ageInput = document.getElementById("age");
    const genderSelect = document.getElementById("gender");
    const platform = document.getElementById("platform");
    const submitButton = document.querySelector(
      "#participantForm button[type='submit']",
    );

    const validateFields = () => {
      const isAgeValid = ageInput && ageInput.value.trim() !== "";
      const isGenderSelected = genderSelect && genderSelect.value.trim() !== "";
      const isPlatformSelected = platform && platform.value.trim() !== "";
      submitButton.disabled = !(
        isAgeValid &&
        isGenderSelected &&
        isPlatformSelected
      );
    };
    ageInput.addEventListener("input", validateFields);
    genderSelect.addEventListener("change", validateFields);
    platform.addEventListener("change", validateFields);

    submitButton.addEventListener("click", (event) => {
      event.preventDefault(); // Prevent the default form submission

      if (
        ageInput.value.trim() !== "" &&
        genderSelect.value.trim() !== "" &&
        platform.value.trim() !== ""
      ) {
        data = {
          age: ageInput.value,
          gender: genderSelect.value,
          platform: platform.value,
        };
        console.log(data);
        handleStartExperiment(ws, data);
      } else {
        console.log("Please complete all fields before submitting.");
      }
    });

    // Initially disable the submit button if the fields are empty
    validateFields();
  } else {
    console.error(`Target element with ID '${targetElementId}' not found.`);
  }
}
async function handleStartExperiment(ws, data) {
  console.log("Start Experiment button clicked");
  if (ws && typeof ws.send === "function") {
    try {
      const message = JSON.stringify({
        stage: "intro",
        type: "consent",
        data: data,
      });
      await sendMessage(ws, message);
    } catch (error) {
      console.error("could not send info message", error);
    }
  } else {
    console.error("WebSocket connection (ws) is invalid or not available.");
  }
}
let instructionEventListenerAttached = false;

function loadInstructions(targetElementId, ws) {
  const targetElement = document.getElementById(targetElementId);
  if (targetElement) {
    targetElement.innerHTML = instructionsHTML;

    // Ensure the event listener is not attached more than once
    if (!instructionEventListenerAttached) {
      const keyPressHandler = (event) => {
        if (event.key === "Enter") {
          loadPracticeInstructions(targetElementId, ws);
          // Remove the event listener
          document.removeEventListener("keyup", keyPressHandler);
          instructionEventListenerAttached = false;
        }
      };

      // Add the event listener
      document.addEventListener("keyup", keyPressHandler, { once: true });
      instructionEventListenerAttached = true;
    }
  } else {
    console.error(`Target element with ID '${targetElementId}' not found.`);
  }
}
function loadWaitingRoom(targetElementId) {
  const targetElement = document.getElementById(targetElementId);
  if (targetElement) {
    targetElement.innerHTML = waiitingRoom;
  }
}
function loadWaitingExpEndRoom(targetElementId) {
  const targetElement = document.getElementById(targetElementId);
  if (targetElement) {
    targetElement.innerHTML = "";
    targetElement.innerHTML = waitingExpEndRoom;
  }
}
let practiceInstructionsHandler;

async function loadPracticeInstructions(targetElementId, ws) {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) {
    console.error(`Target element with ID '${targetElementId}' not found.`);
    return;
  }

  // Insert practice instructions HTML
  targetElement.innerHTML = practiceInstructionsHTML;

  // Remove any existing event listener for keyup
  if (practiceInstructionsHandler) {
    document.removeEventListener("keyup", practiceInstructionsHandler);
  }

  // Define the event handler function
  const enterKeyPromise = new Promise((resolve) => {
    practiceInstructionsHandler = async (event) => {
      if (event.key === "Enter") {
        // Remove the event listener after handling
        console.log("enter key pressed");
        document.removeEventListener("keyup", practiceInstructionsHandler);
        addWaitingMessage(targetElement);
        // Resolve the promise
        resolve();
      }
    };
    // Add the event listener
    document.addEventListener("keyup", practiceInstructionsHandler);
  });

  // Timer promise to handle timeout
  const timerPromise = new Promise((resolve) => {
    setTimeout(() => {
      console.log("timer expired");
      resolve();
    }, 30 * 1000); // 30 seconds
  });

  try {
    await Promise.race([enterKeyPromise, timerPromise]);
    // Handle starting the experiment
    await handleStartExp(ws);

    // Create and insert the "waiting for other player" message
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function handleStartExp(ws) {
  try {
    console.log("Sending start practice instruction");
    const message = JSON.stringify({
      stage: "intro",
      type: "completedInstructions",
    });
    await sendMessage(ws, message);
  } catch (error) {
    console.error("Unable to send start practice instruction:", error);
  }
}
