let model, webcam, labelContainer;
let currentPosture = ""; // For posture status
let lastNotificationTime = 0; // For notification throttling
let webcamStream = null; // To keep track of media stream

// Initialize webcam and PoseNet model
async function init() {
    // Load the PoseNet model if not loaded yet
    if (!model) {
        model = await posenet.load();
    }

    // Request notification permission
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            await Notification.requestPermission();
        }
    }

    // Create and add video element if not already present
    if (!webcam) {
        webcam = document.createElement("video");
        webcam.width = 200;
        webcam.height = 200;
        webcam.autoplay = true;
        webcam.style.transform = "scaleX(-1)"; // mirror video
        document.getElementById("webcam-container").appendChild(webcam);
    }

    try {
        webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcam.srcObject = webcamStream;
    } catch (err) {
        alert("Could not access webcam: " + err.message);
        return;
    }

    webcam.onloadedmetadata = () => {
        webcam.play();
        loop();
    };

    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    labelContainer.appendChild(document.createElement("div"));
}

// Main prediction loop
async function loop() {
    await predict();
    requestAnimationFrame(loop);
}

// Posture detection + notifications
async function predict() {
    if (!model || !webcam) return;

    const pose = await model.estimateSinglePose(webcam, { flipHorizontal: true });

    const leftShoulder = pose.keypoints.find(k => k.part === "leftShoulder");
    const rightShoulder = pose.keypoints.find(k => k.part === "rightShoulder");
    const nose = pose.keypoints.find(k => k.part === "nose");

    const minScore = 0.3;

    if (leftShoulder.score > minScore && rightShoulder.score > minScore && nose.score > minScore) {
        const shoulderWidth = Math.abs(leftShoulder.position.x - rightShoulder.position.x);

        if (shoulderWidth < 10) {
            currentPosture = "Unknown";
            labelContainer.childNodes[0].innerText = "Please move closer to the camera.";
            return;
        }

        const shoulderMidpointX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
        const noseHorizontalOffset = Math.abs(nose.position.x - shoulderMidpointX);
        const leanThreshold = 40;

        if (noseHorizontalOffset > leanThreshold) {
            currentPosture = "Leaning Too Much";
            labelContainer.childNodes[0].innerText = "Leaning too much into the camera!";
        } else {
            const noseAvgY = (leftShoulder.position.y + rightShoulder.position.y) / 2;
            const noseVerticalOffset = Math.abs(nose.position.y - noseAvgY);

            if (noseVerticalOffset < 25) {
                currentPosture = "Good";
                labelContainer.childNodes[0].innerText = "Good posture!";
                console.log("Posture Detected: Good");
            } else {
                currentPosture = "Leaning";
                labelContainer.childNodes[0].innerText = "Leaning detected!";
            }
        }
    } else {
        const scores = [leftShoulder.score, rightShoulder.score, nose.score];
        const detectedCount = scores.filter(s => s > minScore).length;

        if (detectedCount >= 2) {
            currentPosture = "Good";
            labelContainer.childNodes[0].innerText = "Good posture (partial detection).";
            console.log("Posture Detected: Good (partial)");
        } else {
            currentPosture = "Unknown";
            labelContainer.childNodes[0].innerText = "Unable to detect posture. Please ensure upper body is visible.";
        }
    }

    // Notification every 2 seconds if bad posture detected
    if ((currentPosture === "Leaning" || currentPosture === "Leaning Too Much") && Notification.permission === "granted") {
        const now = Date.now();
        if (now - lastNotificationTime > 2000) {
            new Notification("Posture Alert", {
                body: "Please correct your posture: " + currentPosture,
            });
            lastNotificationTime = now;
        }
    }
}

// Send message to Flask backend
function sendMessage() {
    const userInput = document.getElementById("user-input").value;
    if (userInput.trim() === "") return;

    addMessageToChat(userInput, 'user');
    console.log("Sending with posture:", currentPosture);

    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: userInput,
            postureStatus: currentPosture
        }),
    })
    .then(response => response.json())
    .then(data => {
        addMessageToChat(data.response, 'bot');
    })
    .catch((error) => {
        console.error('Error:', error);
    });

    document.getElementById("user-input").value = "";
}

// Add chat message to chat container
function addMessageToChat(message, sender) {
    const chatContainer = document.getElementById("chat-container");
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", sender + "-message");
    messageElement.textContent = message;
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Enter key triggers sendMessage
document.getElementById("user-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// Stop Webcam button handler
document.getElementById("stopCameraButton").addEventListener("click", () => {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (webcam) {
        webcam.pause();
        webcam.srcObject = null;
        webcam.remove();
        webcam = null;
    }
    labelContainer.innerHTML = "";
    currentPosture = "";
});

function addTask() {
  const taskInput = document.getElementById("task-input");
  const taskText = taskInput.value.trim();
  if (!taskText) return;

  const taskItem = document.createElement("div");
  taskItem.className = "task-item";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.addEventListener("change", () => {
    taskInputElem.disabled = checkbox.checked;
  });

  const taskInputElem = document.createElement("input");
  taskInputElem.type = "text";
  taskInputElem.value = taskText;

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "🗑️";
  deleteButton.className = "btn";
  deleteButton.style.background = 
"#e74c3c";
  deleteButton.addEventListener("click", () => {
    taskItem.remove();
  });

  taskItem.appendChild(checkbox);
  taskItem.appendChild(taskInputElem);
  taskItem.appendChild(deleteButton);

  document.getElementById("task-list").appendChild(taskItem);
  taskInput.value = "";
}
