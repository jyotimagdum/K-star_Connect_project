document.addEventListener("DOMContentLoaded", () => {
const params = new URLSearchParams(window.location.search);
const groupId = params.get("group");
const albumName = params.get("album");
const group = window.KSTAR_DATA.groups.find(item => item.id === groupId) || window.KSTAR_DATA.groups[0];
const songs = group.albums[albumName] || [];

document.getElementById("albumHero").style.backgroundImage = `linear-gradient(135deg,rgba(86,58,150,.88),rgba(217,70,239,.62)),url('${group.cover}')`;
document.getElementById("albumTitle").innerText = albumName || "Album";
document.getElementById("albumSubtitle").innerText = `${group.name} - ${group.community}`;
document.getElementById("albumHeading").innerText = `${albumName || "Selected Album"} Songs`;
document.getElementById("songCount").innerText = `${songs.length} songs`;

document.getElementById("songList").innerHTML = songs.map((song, index) => `
<div class="song-row">
<span>${String(index + 1).padStart(2, "0")}</span>
<strong>${escapeHtml(song)}</strong>
</div>
`).join("");
});

function escapeHtml(value){
return String(value)
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
