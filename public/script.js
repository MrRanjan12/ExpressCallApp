const socket = io();
let localStream;
let peerConnection;
let micEnabled = true;
let camEnabled = true;
let isScreenSharing = false;
let screenStream = null;
let isFocusMode = false;

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const roomInput = document.getElementById("roomInput");
const micBtn = document.getElementById("micBtn");
const camBtn = document.getElementById("camBtn");
const screenBtn = document.getElementById("screenBtn");

let roomId = "";

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

async function joinRoom() {
  roomId = roomInput.value.trim();
  if (!roomId) return alert("Please enter a room ID");

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(servers);
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", { roomId, candidate: event.candidate });
    }
  };

  socket.emit("join-room", roomId);

  socket.on("user-joined", async () => {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { roomId, sdp: offer });
  });

  socket.on("offer", async ({ sdp }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { roomId, sdp: answer });
  });

  socket.on("answer", async ({ sdp }) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  });

  socket.on("ice-candidate", ({ candidate }) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on("user-left", () => {
    remoteVideo.srcObject = null;
    if (peerConnection) peerConnection.close();
  });
}

function leaveRoom() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  alert("You left the call.");
}

function toggleMic() {
  if (!localStream) return;
  micEnabled = !micEnabled;
  localStream.getAudioTracks()[0].enabled = micEnabled;
  micBtn.innerHTML = micEnabled ? "🎤 Mute" : "🔇 Unmute";
}

function toggleCamera() {
  if (!localStream) return;
  camEnabled = !camEnabled;
  localStream.getVideoTracks()[0].enabled = camEnabled;
  camBtn.innerHTML = camEnabled ? "📷 Off" : "🚫 On";
}

async function toggleScreen() {
  if (!peerConnection) return alert("Join a room first!");

  if (!isScreenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      const sender = peerConnection.getSenders().find((s) => s.track.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);

      localVideo.srcObject = screenStream;

      screenTrack.onended = async () => {
        const camTrack = localStream.getVideoTracks()[0];
        const sender = peerConnection.getSenders().find((s) => s.track.kind === "video");
        if (sender) await sender.replaceTrack(camTrack);

        localVideo.srcObject = localStream;
        isScreenSharing = false;
        screenBtn.innerText = "🖥️ Share Screen";
      };

      isScreenSharing = true;
      screenBtn.innerText = "🎥 Switch to Camera";
    } catch (err) {
      console.error("Screen share failed:", err);
      alert("Screen share not allowed or failed.");
    }
  } else {
    const camTrack = localStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find((s) => s.track.kind === "video");
    if (sender) await sender.replaceTrack(camTrack);

    localVideo.srcObject = localStream;
    isScreenSharing = false;
    screenBtn.innerText = "🖥️ Share Screen";

    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      screenStream = null;
    }
  }
}

function toggleFocus() {
  const app = document.querySelector(".app");
  const localBox = document.getElementById("localBox");

  isFocusMode = !isFocusMode;

  if (isFocusMode) {
    app.classList.add("focus-mode");
    document.body.classList.add("focus-mode");
    document.getElementById("focusBtn").innerText = "🔄 Grid";

    // Make draggable in focus mode
    makeDraggable(localBox);
  } else {
    app.classList.remove("focus-mode");
    document.body.classList.remove("focus-mode");
    document.getElementById("focusBtn").innerText = "🎯 Focus";

    // Remove custom styles and inline dragging positions
    localBox.style.top = "";
    localBox.style.left = "";
    localBox.style.position = "";
    localBox.style.cursor = "";
    localBox.onmousedown = null;
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function makeDraggable(el) {
  let isDragging = false;
  let offsetX, offsetY;

  el.style.position = "absolute";
  el.style.cursor = "move";

  el.onmousedown = (e) => {
    isDragging = true;
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;
    el.style.zIndex = 1000;
  };

  document.onmousemove = (e) => {
    if (isDragging) {
      el.style.left = e.clientX - offsetX + "px";
      el.style.top = e.clientY - offsetY + "px";
    }
  };

  document.onmouseup = () => {
    isDragging = false;
  };
}


