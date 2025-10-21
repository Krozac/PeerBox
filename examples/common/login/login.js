let ApiUrl = "http://localhost:5502"

async function getRoom(roomId){
    const url = `${ApiUrl}/rooms/${roomId}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        console.log(result);
    } catch (error) {
    console.error(error.message);
  }
}

async function login(roomId, username) {
  const response = await fetch(`${ApiUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, username }),
  });
  
  const { token, gameUrl } = await response.json();
  return {token,gameUrl};
}

const form = document.getElementById('joinForm');

form.addEventListener("submit",async (e) =>{
    e.preventDefault(); 

    roomId = document.getElementById("roomId").value
    username = document.getElementById("username").value;

    const {token,gameUrl} = await login(roomId, username);
    window.location.href = `${gameUrl}?token=${token}`;
})