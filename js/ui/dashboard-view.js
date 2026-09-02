function button(label, className, action) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.addEventListener("click", action);
  return element;
}

function statusBadge(status) {
  const badge = document.createElement("span");
  badge.className = "status-badge";
  const states = {
    running: ["status-running", "Em andamento"],
    finished: ["status-finished", "Finalizado"],
    draft: ["status-draft", "Rascunho"]
  };
  const [className, label] = states[status] || states.draft;
  badge.classList.add(className);
  badge.textContent = label;
  return badge;
}

function metadata(tournament) {
  const root = document.createElement("div");
  root.className = "tournament-meta";
  const values = [
    [tournament.participants.length, tournament.labels.participants],
    [tournament.format.type === "pokemon_swiss" ? "Suíço + Cut" : `BO${tournament.format.bestOf}`, "Formato"],
    [tournament.bracket ? "Sim" : "Não", "Chave criada"]
  ];
  values.forEach(([value, label]) => {
    const box = document.createElement("div");
    box.className = "meta-box";
    const strong = document.createElement("strong");
    strong.textContent = value;
    const span = document.createElement("span");
    span.textContent = label;
    box.append(strong, span);
    root.appendChild(box);
  });
  return root;
}

export function renderDashboard(tournaments, handlers) {
  const grid = document.getElementById("tournamentGrid");
  document.getElementById("tournamentCount").textContent = tournaments.length;
  document.getElementById("emptyDashboard").hidden = tournaments.length > 0;
  grid.innerHTML = "";

  tournaments.forEach(tournament => {
    const card = document.createElement("article");
    card.className = "tournament-card";
    const title = document.createElement("h3");
    title.textContent = tournament.name;
    const description = document.createElement("p");
    description.className = "description";
    description.textContent = tournament.description || tournament.subtitle || "Sem descrição.";
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.append(
      button("Abrir", "btn btn-primary open", () => handlers.open(tournament.id)),
      button("Duplicar", "btn btn-ghost", () => handlers.duplicate(tournament.id)),
      button("Excluir", "btn btn-danger", () => handlers.remove(tournament))
    );
    card.append(statusBadge(tournament.status), title, description, metadata(tournament), actions);
    grid.appendChild(card);
  });
}
