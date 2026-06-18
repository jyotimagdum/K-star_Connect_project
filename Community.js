document.addEventListener("DOMContentLoaded", () => {
const params = new URLSearchParams(window.location.search);
const groupId = params.get("group");
const group = window.KSTAR_DATA.groups.find(item => item.id === groupId) || window.KSTAR_DATA.groups[0];

document.getElementById("communityHero").style.backgroundImage = `linear-gradient(135deg,rgba(86,58,150,.88),rgba(217,70,239,.62)),url('${group.cover}')`;
document.getElementById("communityTitle").innerText = group.community;
document.getElementById("communitySubtitle").innerText = `You joined ${group.name}'s fan community.`;

document.getElementById("communityProfile").innerHTML = `
<div class="joined-community">
<img class="joined-community-img" src="${group.profile}" alt="${group.name} profile picture">
<div>
<span class="eyebrow">Joined Community</span>
<h2>${group.name}</h2>
<p class="muted">${group.role} - ${group.members.toLocaleString()} fans</p>
</div>
</div>
`;

document.getElementById("communityAlbums").innerHTML = Object.keys(group.albums).map(album => `
<a class="album-chip" href="Album.html?group=${encodeURIComponent(group.id)}&album=${encodeURIComponent(album)}">${album}</a>
`).join("");
});
