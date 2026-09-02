import { Utils } from "./utils.js";
import { Storage } from "./data/storage.js";
import { BracketEngine } from "./domain/bracket-engine.js";
import { renderDashboard as renderDashboardView } from "./ui/dashboard-view.js";

const App = {
  currentTournament: null,

  init() {
    App.bindGlobalEvents();
    App.bindEditorEvents();
    App.renderDashboard();
  },

  bindGlobalEvents() {
    document.getElementById("newTournamentBtn").addEventListener("click", App.createTournament);
    document.getElementById("emptyCreateBtn").addEventListener("click", App.createTournament);
    document.getElementById("backDashboardBtn").addEventListener("click", App.closeEditor);
    document.getElementById("saveCurrentBtn").addEventListener("click", () => App.saveCurrent("Campeonato salvo."));

    document.querySelectorAll(".nav-item").forEach(button => {
      button.addEventListener("click", () => App.setTab(button.dataset.tab));
    });
  },

  bindEditorEvents() {
    document.getElementById("saveIdentityBtn").addEventListener("click", App.saveIdentity);
    document.getElementById("saveFormatBtn").addEventListener("click", App.saveFormat);

    document.getElementById("ruleForm").addEventListener("submit", App.submitRule);
    document.getElementById("cancelRuleEditBtn").addEventListener("click", App.clearRuleForm);

    document.getElementById("awardForm").addEventListener("submit", App.submitAward);
    document.getElementById("cancelAwardEditBtn").addEventListener("click", App.clearAwardForm);

    document.getElementById("participantForm").addEventListener("submit", App.submitParticipant);
    document.getElementById("cancelParticipantEditBtn").addEventListener("click", App.clearParticipantForm);

    document.getElementById("startTournamentBtn").addEventListener("click", App.startTournament);
    document.getElementById("nextSwissRoundBtn").addEventListener("click", App.nextSwissRound);
    document.getElementById("startTopCutBtn").addEventListener("click", App.startTopCut);
    document.getElementById("resetTournamentBtn").addEventListener("click", App.resetTournament);
    document.getElementById("formatTypeInput").addEventListener("change", App.toggleFormatFields);
  },

  createTournament() {
    const tournament = Storage.create();
    App.openTournament(tournament.id);
  },

  closeEditor() {
    App.currentTournament = null;
    document.getElementById("editorView").hidden = true;
    document.getElementById("dashboardView").hidden = false;
    App.renderDashboard();
  },

  openTournament(id) {
    const tournament = Storage.get(id);

    if (!tournament) {
      Utils.toast("Campeonato não encontrado.");
      return;
    }

    App.currentTournament = tournament;
    document.getElementById("dashboardView").hidden = true;
    document.getElementById("editorView").hidden = false;

    App.loadIdentityForm();
    App.loadFormatForm();
    App.refreshLabels();
    App.setTab("overview");
    App.renderAll();
  },

  saveCurrent(message = null) {
    if (!App.currentTournament) return;
    App.updateStatus();
    App.currentTournament = Storage.save(App.currentTournament);
    App.updateEditorHeader();
    if (message) Utils.toast(message);
  },

  updateStatus() {
    const t = App.currentTournament;
    if (!t) return;

    if (!t.bracket) {
      t.status = "draft";
    } else if (t.bracket.championId) {
      t.status = "finished";
    } else {
      t.status = "running";
    }
  },

  updateEditorHeader() {
    const t = App.currentTournament;
    if (!t) return;

    App.updateStatus();

    document.getElementById("editorTournamentName").textContent = t.name;
    document.getElementById("editorTournamentSubtitle").textContent = t.subtitle || t.description || "";

    const badge = document.getElementById("statusBadge");
    badge.className = "status-badge";

    if (t.status === "finished") {
      badge.classList.add("status-finished");
      badge.textContent = "Finalizado";
    } else if (t.status === "running") {
      badge.classList.add("status-running");
      badge.textContent = "Em andamento";
    } else {
      badge.classList.add("status-draft");
      badge.textContent = "Rascunho";
    }
  },

  setTab(tab) {
    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });

    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === `tab-${tab}`);
    });

    if (!App.currentTournament) return;

    if (tab === "overview") App.renderOverview();
    if (tab === "rules") App.renderRules();
    if (tab === "awards") App.renderAwards();
    if (tab === "participants") App.renderParticipants();
    if (tab === "bracket") App.renderBracket();
    if (tab === "history") App.renderHistory();
  },

  renderDashboard() {
    const tournaments = Storage.list();
    renderDashboardView(tournaments, {
      open: App.openTournament,
      duplicate(id) {
        Storage.duplicate(id);
        Utils.toast("Campeonato duplicado.");
        App.renderDashboard();
      },
      remove(tournament) {
        if (!confirm(`Excluir "${tournament.name}"?`)) return;
        Storage.remove(tournament.id);
        App.renderDashboard();
      }
    });
  },

  loadIdentityForm() {
    const t = App.currentTournament;
    document.getElementById("nameInput").value = t.name;
    document.getElementById("subtitleInput").value = t.subtitle;
    document.getElementById("descriptionInput").value = t.description;
    document.getElementById("participantsLabelInput").value = t.labels.participants;
    document.getElementById("bracketLabelInput").value = t.labels.bracket;
    document.getElementById("rulesLabelInput").value = t.labels.rules;
    document.getElementById("awardsLabelInput").value = t.labels.awards;
    document.getElementById("championLabelInput").value = t.labels.champion;
  },

  saveIdentity() {
    const t = App.currentTournament;
    const name = Utils.clean(document.getElementById("nameInput").value);

    if (!name) {
      Utils.toast("Informe o nome do campeonato.");
      return;
    }

    t.name = name;
    t.subtitle = Utils.clean(document.getElementById("subtitleInput").value);
    t.description = document.getElementById("descriptionInput").value.trim();
    t.labels.participants = Utils.clean(document.getElementById("participantsLabelInput").value) || "Participantes";
    t.labels.bracket = Utils.clean(document.getElementById("bracketLabelInput").value) || "Chaveamento";
    t.labels.rules = Utils.clean(document.getElementById("rulesLabelInput").value) || "Regulamento";
    t.labels.awards = Utils.clean(document.getElementById("awardsLabelInput").value) || "Premiação";
    t.labels.champion = Utils.clean(document.getElementById("championLabelInput").value) || "Campeão";

    App.saveCurrent("Identidade atualizada.");
    App.refreshLabels();
    App.renderOverview();
  },

  loadFormatForm() {
    const t = App.currentTournament;
    const locked = Boolean(t.bracket);

    document.getElementById("formatTypeInput").value = t.format.type;
    document.getElementById("drawModeInput").value = t.format.drawMode;
    document.getElementById("bestOfInput").value = String(t.format.bestOf);
    document.getElementById("finalBestOfInput").value = String(t.format.finalBestOf);
    document.getElementById("thirdPlaceInput").checked = Boolean(t.format.thirdPlace);
    document.getElementById("swissRoundsInput").value = String(t.format.swissRounds || "auto");
    document.getElementById("topCutSizeInput").value = String(t.format.topCutSize || "auto");

    [
      "formatTypeInput",
      "drawModeInput",
      "bestOfInput",
      "finalBestOfInput",
      "thirdPlaceInput",
      "swissRoundsInput",
      "topCutSizeInput",
      "saveFormatBtn"
    ].forEach(id => {
      document.getElementById(id).disabled = locked;
    });

    document.getElementById("formatLockedNotice").hidden = !locked;
    App.toggleFormatFields();
  },

  toggleFormatFields() {
    const isPokemon = document.getElementById("formatTypeInput").value === "pokemon_swiss";
    document.getElementById("swissRoundsField").hidden = !isPokemon;
    document.getElementById("topCutField").hidden = !isPokemon;
    document.getElementById("pokemonFormatNotice").hidden = !isPokemon;
  },

  saveFormat() {
    const t = App.currentTournament;

    if (t.bracket) {
      Utils.toast("Reinicie o chaveamento antes de alterar o formato.");
      return;
    }

    t.format.type = document.getElementById("formatTypeInput").value;
    t.format.drawMode = document.getElementById("drawModeInput").value;
    t.format.bestOf = Number(document.getElementById("bestOfInput").value);
    t.format.finalBestOf = Number(document.getElementById("finalBestOfInput").value);
    t.format.thirdPlace = document.getElementById("thirdPlaceInput").checked;
    t.format.swissRounds = document.getElementById("swissRoundsInput").value;
    t.format.topCutSize = document.getElementById("topCutSizeInput").value;

    App.saveCurrent("Formato atualizado.");
    App.renderOverview();
  },

  refreshLabels() {
    const t = App.currentTournament;
    document.getElementById("rulesPageTitle").textContent = t.labels.rules;
    document.getElementById("awardsPageTitle").textContent = t.labels.awards;
    document.getElementById("participantsPageTitle").textContent = t.labels.participants;
    document.getElementById("bracketPageTitle").textContent = t.labels.bracket;
  },

  moveItem(array, index, direction) {
    const target = index + direction;
    if (target < 0 || target >= array.length) return;
    [array[index], array[target]] = [array[target], array[index]];
  },

  clearRuleForm() {
    document.getElementById("ruleEditId").value = "";
    document.getElementById("ruleTitleInput").value = "";
    document.getElementById("ruleContentInput").value = "";
    document.getElementById("cancelRuleEditBtn").hidden = true;
  },

  submitRule(event) {
    event.preventDefault();
    const t = App.currentTournament;
    const title = Utils.clean(document.getElementById("ruleTitleInput").value);
    const content = document.getElementById("ruleContentInput").value.trim();
    const editId = document.getElementById("ruleEditId").value;

    if (!title || !content) {
      Utils.toast("Preencha o título e o conteúdo.");
      return;
    }

    if (editId) {
      const rule = t.rules.find(item => item.id === editId);
      if (rule) {
        rule.title = title;
        rule.content = content;
      }
    } else {
      t.rules.push({ id: Utils.id("rule"), title, content });
    }

    App.saveCurrent("Regulamento atualizado.");
    App.clearRuleForm();
    App.renderRules();
    App.renderOverview();
  },

  renderRules() {
    const t = App.currentTournament;
    const list = document.getElementById("rulesList");
    list.innerHTML = "";

    if (!t.rules.length) {
      list.innerHTML = '<div class="empty-state">Nenhuma seção criada ainda.</div>';
      return;
    }

    t.rules.forEach((rule, index) => {
      const card = document.createElement("article");
      card.className = "list-card";

      const order = document.createElement("div");
      order.className = "order-controls";

      const up = document.createElement("button");
      up.className = "icon-btn";
      up.type = "button";
      up.textContent = "↑";
      up.disabled = index === 0;
      up.addEventListener("click", () => {
        App.moveItem(t.rules, index, -1);
        App.saveCurrent(null);
        App.renderRules();
        App.renderOverview();
      });

      const down = document.createElement("button");
      down.className = "icon-btn";
      down.type = "button";
      down.textContent = "↓";
      down.disabled = index === t.rules.length - 1;
      down.addEventListener("click", () => {
        App.moveItem(t.rules, index, 1);
        App.saveCurrent(null);
        App.renderRules();
        App.renderOverview();
      });

      order.append(up, down);

      const content = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = rule.title;
      const text = document.createElement("p");
      text.className = "prewrap";
      text.textContent = rule.content;
      content.append(title, text);

      const actions = document.createElement("div");
      actions.className = "row-actions";

      const edit = document.createElement("button");
      edit.className = "btn btn-ghost btn-small";
      edit.type = "button";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => {
        document.getElementById("ruleEditId").value = rule.id;
        document.getElementById("ruleTitleInput").value = rule.title;
        document.getElementById("ruleContentInput").value = rule.content;
        document.getElementById("cancelRuleEditBtn").hidden = false;
        document.getElementById("ruleTitleInput").focus();
      });

      const remove = document.createElement("button");
      remove.className = "btn btn-danger btn-small";
      remove.type = "button";
      remove.textContent = "Excluir";
      remove.addEventListener("click", () => {
        if (!confirm(`Excluir a seção "${rule.title}"?`)) return;
        t.rules = t.rules.filter(item => item.id !== rule.id);
        App.saveCurrent("Seção excluída.");
        App.renderRules();
        App.renderOverview();
      });

      actions.append(edit, remove);
      card.append(order, content, actions);
      list.appendChild(card);
    });
  },

  clearAwardForm() {
    document.getElementById("awardEditId").value = "";
    document.getElementById("awardTitleInput").value = "";
    document.getElementById("awardDescriptionInput").value = "";
    document.getElementById("cancelAwardEditBtn").hidden = true;
  },

  submitAward(event) {
    event.preventDefault();
    const t = App.currentTournament;
    const title = Utils.clean(document.getElementById("awardTitleInput").value);
    const description = document.getElementById("awardDescriptionInput").value.trim();
    const editId = document.getElementById("awardEditId").value;

    if (!title || !description) {
      Utils.toast("Preencha o título e a premiação.");
      return;
    }

    if (editId) {
      const award = t.awards.find(item => item.id === editId);
      if (award) {
        award.title = title;
        award.description = description;
      }
    } else {
      t.awards.push({ id: Utils.id("award"), title, description });
    }

    App.saveCurrent("Premiação atualizada.");
    App.clearAwardForm();
    App.renderAwards();
    App.renderOverview();
  },

  renderAwards() {
    const t = App.currentTournament;
    const list = document.getElementById("awardsList");
    list.innerHTML = "";

    if (!t.awards.length) {
      list.innerHTML = '<div class="empty-state">Nenhuma premiação cadastrada ainda.</div>';
      return;
    }

    t.awards.forEach((award, index) => {
      const card = document.createElement("article");
      card.className = "award-card";

      const title = document.createElement("h3");
      title.textContent = award.title;

      const description = document.createElement("p");
      description.className = "prewrap";
      description.textContent = award.description;

      const actions = document.createElement("div");
      actions.className = "row-actions";

      const up = document.createElement("button");
      up.className = "btn btn-ghost btn-small";
      up.type = "button";
      up.textContent = "↑";
      up.disabled = index === 0;
      up.addEventListener("click", () => {
        App.moveItem(t.awards, index, -1);
        App.saveCurrent(null);
        App.renderAwards();
        App.renderOverview();
      });

      const down = document.createElement("button");
      down.className = "btn btn-ghost btn-small";
      down.type = "button";
      down.textContent = "↓";
      down.disabled = index === t.awards.length - 1;
      down.addEventListener("click", () => {
        App.moveItem(t.awards, index, 1);
        App.saveCurrent(null);
        App.renderAwards();
        App.renderOverview();
      });

      const edit = document.createElement("button");
      edit.className = "btn btn-ghost btn-small";
      edit.type = "button";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => {
        document.getElementById("awardEditId").value = award.id;
        document.getElementById("awardTitleInput").value = award.title;
        document.getElementById("awardDescriptionInput").value = award.description;
        document.getElementById("cancelAwardEditBtn").hidden = false;
        document.getElementById("awardTitleInput").focus();
      });

      const remove = document.createElement("button");
      remove.className = "btn btn-danger btn-small";
      remove.type = "button";
      remove.textContent = "Excluir";
      remove.addEventListener("click", () => {
        if (!confirm(`Excluir "${award.title}"?`)) return;
        t.awards = t.awards.filter(item => item.id !== award.id);
        App.saveCurrent("Premiação excluída.");
        App.renderAwards();
        App.renderOverview();
      });

      actions.append(up, down, edit, remove);
      card.append(title, description, actions);
      list.appendChild(card);
    });
  },

  clearParticipantForm() {
    document.getElementById("participantEditId").value = "";
    document.getElementById("participantNameInput").value = "";
    document.getElementById("participantNoteInput").value = "";
    document.getElementById("cancelParticipantEditBtn").hidden = true;
  },

  submitParticipant(event) {
    event.preventDefault();
    const t = App.currentTournament;

    if (t.bracket) {
      Utils.toast("Reinicie o chaveamento antes de alterar participantes.");
      return;
    }

    const name = Utils.clean(document.getElementById("participantNameInput").value);
    const note = Utils.clean(document.getElementById("participantNoteInput").value);
    const editId = document.getElementById("participantEditId").value;

    if (!name) {
      Utils.toast("Informe o nome do participante.");
      return;
    }

    const duplicate = t.participants.some(
      p => p.name.toLowerCase() === name.toLowerCase() && p.id !== editId
    );

    if (duplicate) {
      Utils.toast("Já existe um participante com esse nome.");
      return;
    }

    if (editId) {
      const participant = t.participants.find(p => p.id === editId);
      if (participant) {
        participant.name = name;
        participant.note = note;
      }
    } else {
      t.participants.push({ id: Utils.id("participant"), name, note });
    }

    App.saveCurrent("Participantes atualizados.");
    App.clearParticipantForm();
    App.renderParticipants();
    App.renderOverview();
  },

  renderParticipants() {
    const t = App.currentTournament;
    const locked = Boolean(t.bracket);

    document.getElementById("participantsCount").textContent = t.participants.length;
    document.getElementById("participantsLockedNotice").hidden = !locked;
    document.getElementById("participantNameInput").disabled = locked;
    document.getElementById("participantNoteInput").disabled = locked;
    document.getElementById("participantSubmitBtn").disabled = locked;

    const list = document.getElementById("participantsList");
    list.innerHTML = "";

    if (!t.participants.length) {
      list.innerHTML = '<div class="empty-state">Nenhum participante cadastrado.</div>';
      return;
    }

    t.participants.forEach((participant, index) => {
      const row = document.createElement("article");
      row.className = "participant-row";

      const number = document.createElement("span");
      number.className = "participant-number";
      number.textContent = index + 1;

      const info = document.createElement("div");
      info.className = "participant-info";

      const name = document.createElement("strong");
      name.textContent = participant.name;

      const note = document.createElement("span");
      note.textContent = participant.note || "Sem observação";

      info.append(name, note);

      const actions = document.createElement("div");
      actions.className = "row-actions";

      const edit = document.createElement("button");
      edit.className = "btn btn-ghost btn-small";
      edit.type = "button";
      edit.textContent = "Editar";
      edit.disabled = locked;
      edit.addEventListener("click", () => {
        document.getElementById("participantEditId").value = participant.id;
        document.getElementById("participantNameInput").value = participant.name;
        document.getElementById("participantNoteInput").value = participant.note || "";
        document.getElementById("cancelParticipantEditBtn").hidden = false;
        document.getElementById("participantNameInput").focus();
      });

      const remove = document.createElement("button");
      remove.className = "btn btn-danger btn-small";
      remove.type = "button";
      remove.textContent = "Excluir";
      remove.disabled = locked;
      remove.addEventListener("click", () => {
        if (!confirm(`Excluir "${participant.name}"?`)) return;
        t.participants = t.participants.filter(p => p.id !== participant.id);
        App.saveCurrent("Participante excluído.");
        App.renderParticipants();
        App.renderOverview();
      });

      actions.append(edit, remove);
      row.append(number, info, actions);
      list.appendChild(row);
    });
  },

  participantName(id) {
    return App.currentTournament.participants.find(p => p.id === id)?.name || "Aguardando...";
  },

  startTournament() {
    const t = App.currentTournament;

    if (t.participants.length < 2) {
      Utils.toast("Cadastre pelo menos 2 participantes.");
      return;
    }

    if (t.bracket) {
      Utils.toast("O chaveamento já foi criado.");
      return;
    }

    try {
      t.bracket = BracketEngine.build(t);
      App.saveCurrent("Chaveamento criado.");
      App.loadFormatForm();
      App.renderParticipants();
      App.renderBracket();
      App.renderHistory();
      App.renderOverview();
    } catch (error) {
      Utils.toast(error.message || "Não foi possível gerar o chaveamento.");
    }
  },

  nextSwissRound() {
    try {
      BracketEngine.addSwissRound(App.currentTournament);
      App.saveCurrent("Nova rodada suíça gerada.");
      App.renderBracket();
      App.renderHistory();
      App.renderOverview();
    } catch (error) {
      Utils.toast(error.message || "Não foi possível gerar a próxima rodada.");
    }
  },

  startTopCut() {
    try {
      BracketEngine.buildTopCut(App.currentTournament);
      App.saveCurrent("Top Cut gerado pela classificação.");
      App.renderBracket();
      App.renderHistory();
      App.renderOverview();
    } catch (error) {
      Utils.toast(error.message || "Não foi possível gerar o Top Cut.");
    }
  },

  resetTournament() {
    const t = App.currentTournament;
    if (!t.bracket) return;

    if (!confirm("Apagar todo o chaveamento e todos os resultados? Os participantes e configurações serão mantidos.")) {
      return;
    }

    t.bracket = null;
    t.status = "draft";
    App.saveCurrent("Chaveamento reiniciado.");
    App.loadFormatForm();
    App.renderParticipants();
    App.renderBracket();
    App.renderHistory();
    App.renderOverview();
  },

  createMatchPlayer(match, slot, target) {
    const id = slot === 1 ? match.p1 : match.p2;
    const wins = slot === 1 ? match.wins1 : match.wins2;

    const row = document.createElement("div");
    row.className = "match-player";

    if (!id) {
      row.classList.add("pending");

      const name = document.createElement("span");
      name.className = "match-name";
      name.textContent = match.isBye ? "BYE — folga" : "Aguardando...";

      const score = document.createElement("span");
      score.className = "match-score";
      score.textContent = "—";

      row.append(name, score, document.createElement("span"));
      return row;
    }

    if (match.winnerId === id) row.classList.add("winner");

    const name = document.createElement("span");
    name.className = "match-name";
    name.textContent = App.participantName(id);

    const score = document.createElement("span");
    score.className = "match-score";
    score.textContent = wins;

    const button = document.createElement("button");
    button.className = "match-win-btn";
    button.type = "button";
    button.textContent = "+ vitória";
    button.disabled = Boolean(match.completedAt) || !match.p1 || !match.p2;
    button.addEventListener("click", () => {
      BracketEngine.recordWin(App.currentTournament, target, slot);
      App.saveCurrent(null);
      App.renderBracket();
      App.renderHistory();
      App.renderOverview();

      if (match.winnerId) {
        Utils.toast(`${App.participantName(match.winnerId)} venceu o confronto.`);
      }
    });

    row.append(name, score, button);
    return row;
  },

  createMatchCard(match, label, target) {
    const card = document.createElement("article");
    card.className = "match";

    if (match.completedAt) card.classList.add("complete");

    const top = document.createElement("div");
    top.className = "match-label";
    top.textContent = `${label} • BO${match.bestOf}`;

    card.append(
      top,
      App.createMatchPlayer(match, 1, target),
      App.createMatchPlayer(match, 2, target)
    );

    if (match.wins1 || match.wins2 || match.completedAt) {
      const footer = document.createElement("div");
      footer.className = "match-footer";

      const info = document.createElement("span");

      if (match.result === "draw") {
        info.textContent = "Resultado: empate";
      } else if (match.isBye) {
        info.textContent = "Vitória automática por BYE";
      } else if (match.winnerId) {
        info.append("Classificado: ");
        const strong = document.createElement("strong");
        strong.textContent = App.participantName(match.winnerId);
        info.appendChild(strong);
      } else {
        info.textContent = `Placar: ${match.wins1} × ${match.wins2}`;
      }

      const reset = document.createElement("button");
      reset.className = "btn btn-ghost btn-small";
      reset.type = "button";
      reset.textContent = "Zerar";
      const swissLocked = target.type === "swiss" &&
        (target.round !== App.currentTournament.bracket.swissRounds.length - 1 ||
          Boolean(App.currentTournament.bracket.topCut));
      reset.hidden = Boolean(match.isBye) || swissLocked;
      reset.addEventListener("click", () => {
        if (!confirm("Zerar este confronto? Resultados posteriores que dependam dele poderão ser apagados.")) return;
        BracketEngine.resetMatch(App.currentTournament, target);
        App.saveCurrent(null);
        App.renderBracket();
        App.renderHistory();
        App.renderOverview();
      });

      footer.append(info, reset);
      card.appendChild(footer);
    }

    if (target.type === "swiss" && !match.completedAt && match.p1 && match.p2) {
      const actions = document.createElement("div");
      actions.className = "match-actions";
      const draw = document.createElement("button");
      draw.className = "btn btn-ghost btn-small";
      draw.type = "button";
      draw.textContent = "Registrar empate";
      draw.addEventListener("click", () => {
        if (!confirm("Registrar este confronto como empate?")) return;
        BracketEngine.recordDraw(App.currentTournament, target);
        App.saveCurrent(null);
        App.renderBracket();
        App.renderHistory();
        App.renderOverview();
      });
      actions.appendChild(draw);
      card.appendChild(actions);
    }

    return card;
  },

  createEliminationView(activeBracket, targetType = "main") {
    const bracket = document.createElement("div");
    bracket.className = "bracket";

    activeBracket.rounds.forEach((round, roundIndex) => {
      const column = document.createElement("section");
      column.className = "round";
      const title = document.createElement("h3");
      title.className = "round-title";
      title.textContent = round.name;
      const matches = document.createElement("div");
      matches.className = "round-matches";

      round.matches.forEach((match, matchIndex) => {
        matches.appendChild(App.createMatchCard(
          match,
          `Confronto ${matchIndex + 1}`,
          { type: targetType, round: roundIndex, match: matchIndex }
        ));
      });

      column.append(title, matches);
      bracket.appendChild(column);
    });
    return bracket;
  },

  renderStandings(t) {
    const block = document.createElement("section");
    block.className = "swiss-section";
    const title = document.createElement("h3");
    title.className = "phase-title";
    title.textContent = "Classificação suíça";
    const help = document.createElement("p");
    help.className = "muted small standings-help";
    help.textContent = "As linhas destacadas estão na zona do Top Cut. Desempates: OMW%, aproveitamento de games e games vencidos.";
    const scroll = document.createElement("div");
    scroll.className = "standings-scroll";
    const table = document.createElement("table");
    table.className = "standings-table";
    table.innerHTML = "<thead><tr><th>#</th><th>Treinador</th><th>V–E–D</th><th>Games</th><th>Pontos</th><th>OMW%</th></tr></thead>";
    const body = document.createElement("tbody");

    BracketEngine.standings(t).forEach((entry, index) => {
      const row = document.createElement("tr");
      if (index < t.bracket.topCutSize) row.classList.add("cut-line");
      [
        index + 1,
        App.participantName(entry.id),
        `${entry.wins}–${entry.draws}–${entry.losses}`,
        `${entry.gamesWon}–${entry.gamesLost}`,
        entry.points,
        `${(entry.omw * 100).toFixed(1)}%`
      ].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });

    table.appendChild(body);
    scroll.appendChild(table);
    block.append(title, help, scroll);
    return block;
  },

  renderPokemonBracket(t, container, thirdContainer, championCard) {
    const bracket = t.bracket;
    const currentRound = bracket.swissRounds.at(-1);
    const roundComplete = currentRound?.matches.every(match => Boolean(match.completedAt));
    const swissComplete = bracket.swissRounds.length >= bracket.swissRoundsTarget && roundComplete;

    document.getElementById("bracketEyebrow").textContent = bracket.topCut ? "Top Cut" : "Rodadas suíças";
    document.getElementById("nextSwissRoundBtn").hidden = !(
      bracket.phase === "swiss" && roundComplete && bracket.swissRounds.length < bracket.swissRoundsTarget
    );
    document.getElementById("startTopCutBtn").hidden = !(bracket.phase === "swiss" && swissComplete);
    document.getElementById("bracketHelp").textContent =
      `${t.participants.length} participantes • Suíço ${bracket.swissRounds.length}/${bracket.swissRoundsTarget} • Top ${bracket.topCutSize} • BO${t.format.bestOf}`;

    container.appendChild(App.renderStandings(t));

    const roundsTitle = document.createElement("h3");
    roundsTitle.className = "phase-title";
    roundsTitle.textContent = "Confrontos suíços";
    const roundsGrid = document.createElement("div");
    roundsGrid.className = "swiss-rounds";

    bracket.swissRounds.forEach((round, roundIndex) => {
      const roundBlock = document.createElement("section");
      roundBlock.className = "swiss-round";
      const title = document.createElement("h4");
      title.textContent = round.name;
      roundBlock.appendChild(title);
      round.matches.forEach((match, matchIndex) => {
        roundBlock.appendChild(App.createMatchCard(
          match,
          `Mesa ${matchIndex + 1}`,
          { type: "swiss", round: roundIndex, match: matchIndex }
        ));
      });
      roundsGrid.appendChild(roundBlock);
    });
    container.append(roundsTitle, roundsGrid);

    if (bracket.topCut) {
      const topCutTitle = document.createElement("h3");
      topCutTitle.className = "phase-title top-cut-title";
      topCutTitle.textContent = `Top ${bracket.topCutSize} — eliminação simples`;
      const topCutWrap = document.createElement("div");
      topCutWrap.className = "bracket-wrap nested-bracket";
      topCutWrap.appendChild(App.createEliminationView(bracket.topCut, "topcut"));
      container.append(topCutTitle, topCutWrap);

      if (bracket.topCut.thirdPlace) {
        const block = document.createElement("div");
        block.className = "third-place-block";
        const title = document.createElement("h3");
        title.textContent = "Disputa de terceiro lugar";
        block.append(title, App.createMatchCard(
          bracket.topCut.thirdPlace,
          "3º lugar",
          { type: "topcut-third" }
        ));
        thirdContainer.appendChild(block);
      }
    }

    App.renderChampion(t, championCard);
  },

  renderChampion(t, championCard) {
    if (!t.bracket.championId) {
      championCard.hidden = true;
      return;
    }

    championCard.hidden = false;
    championCard.innerHTML = "";
    const trophy = document.createElement("span");
    trophy.className = "trophy";
    trophy.textContent = "🏆";
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = t.labels.champion;
    const name = document.createElement("h3");
    name.textContent = App.participantName(t.bracket.championId);
    const text = document.createElement("p");
    text.className = "muted";
    text.textContent = `${t.labels.champion} de ${t.name}`;
    championCard.append(trophy, eyebrow, name, text);
  },

  renderBracket() {
    const t = App.currentTournament;
    const container = document.getElementById("bracketContainer");
    const thirdContainer = document.getElementById("thirdPlaceContainer");
    const championCard = document.getElementById("championCard");

    container.innerHTML = "";
    thirdContainer.innerHTML = "";

    const hasBracket = Boolean(t.bracket);
    const isPokemonFormat = t.format.type === "pokemon_swiss";
    const startButton = document.getElementById("startTournamentBtn");
    startButton.hidden = hasBracket;
    startButton.textContent = isPokemonFormat ? "🎲 Iniciar rodadas suíças" : "🎲 Gerar chaveamento";
    document.getElementById("nextSwissRoundBtn").hidden = true;
    document.getElementById("startTopCutBtn").hidden = true;
    document.getElementById("resetTournamentBtn").hidden = !hasBracket;

    if (!hasBracket) {
      document.getElementById("bracketEyebrow").textContent = isPokemonFormat ? "Pokémon competitivo" : "Mata-mata";
      document.getElementById("bracketHelp").textContent = isPokemonFormat
        ? "Cadastre pelo menos 2 participantes e inicie as rodadas suíças."
        : "Cadastre pelo menos 2 participantes e gere o chaveamento.";
      container.innerHTML = '<div class="empty-state">O chaveamento ainda não foi criado.</div>';
      championCard.hidden = true;
      return;
    }

    BracketEngine.sync(t);

    if (BracketEngine.isPokemonSwiss(t.bracket)) {
      App.renderPokemonBracket(t, container, thirdContainer, championCard);
      return;
    }

    document.getElementById("bracketEyebrow").textContent = "Mata-mata";

    document.getElementById("bracketHelp").textContent =
      `${t.participants.length} participantes • BO${t.format.bestOf} • Final BO${t.format.finalBestOf}`;

    const bracket = document.createElement("div");
    bracket.className = "bracket";

    t.bracket.rounds.forEach((round, roundIndex) => {
      const column = document.createElement("section");
      column.className = "round";

      const title = document.createElement("h3");
      title.className = "round-title";
      title.textContent = round.name;

      const matches = document.createElement("div");
      matches.className = "round-matches";

      round.matches.forEach((match, matchIndex) => {
        matches.appendChild(
          App.createMatchCard(
            match,
            `Confronto ${matchIndex + 1}`,
            { type: "main", round: roundIndex, match: matchIndex }
          )
        );
      });

      column.append(title, matches);
      bracket.appendChild(column);
    });

    container.appendChild(bracket);

    if (t.bracket.thirdPlace) {
      const block = document.createElement("div");
      block.className = "third-place-block";

      const title = document.createElement("h3");
      title.textContent = "Disputa de terceiro lugar";

      block.append(
        title,
        App.createMatchCard(t.bracket.thirdPlace, "3º lugar", { type: "third" })
      );

      thirdContainer.appendChild(block);
    }

    if (t.bracket.championId) {
      championCard.hidden = false;
      championCard.innerHTML = "";

      const trophy = document.createElement("span");
      trophy.className = "trophy";
      trophy.textContent = "🏆";

      const eyebrow = document.createElement("span");
      eyebrow.className = "eyebrow";
      eyebrow.textContent = t.labels.champion;

      const name = document.createElement("h3");
      name.textContent = App.participantName(t.bracket.championId);

      const text = document.createElement("p");
      text.className = "muted";
      text.textContent = `${t.labels.champion} de ${t.name}`;

      championCard.append(trophy, eyebrow, name, text);
    } else {
      championCard.hidden = true;
    }
  },

  renderHistory() {
    const t = App.currentTournament;
    const list = document.getElementById("historyList");
    list.innerHTML = "";

    const matches = BracketEngine.completedMatches(t);

    if (!matches.length) {
      list.innerHTML = '<div class="empty-state">Nenhum confronto concluído ainda.</div>';
      return;
    }

    matches.forEach(match => {
      const row = document.createElement("article");
      row.className = "history-item";

      const info = document.createElement("div");

      const title = document.createElement("strong");
      if (match.isBye) {
        title.textContent = `${App.participantName(match.p1)} recebeu um BYE`;
      } else {
        title.textContent = `${App.participantName(match.p1)} ${match.wins1} × ${match.wins2} ${App.participantName(match.p2)}`;
      }

      const meta = document.createElement("span");
      meta.textContent = `${match.roundName} • BO${match.bestOf} • ${Utils.formatDate(match.completedAt)}`;

      info.append(title, meta);

      const winner = document.createElement("div");
      const winnerStrong = document.createElement("strong");
      winnerStrong.textContent = match.result === "draw"
        ? "Empate"
        : match.isBye
          ? "+3 pontos"
          : App.participantName(match.winnerId);
      winner.appendChild(winnerStrong);

      row.append(info, winner);
      list.appendChild(row);
    });
  },

  renderOverview() {
    const t = App.currentTournament;
    const root = document.getElementById("tab-overview");
    root.innerHTML = "";

    const hero = document.createElement("section");
    hero.className = "card overview-hero";

    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = t.subtitle || "Campeonato";

    const title = document.createElement("h2");
    title.textContent = t.name;

    const description = document.createElement("p");
    description.className = "overview-description";
    description.textContent = t.description || "Sem descrição cadastrada.";

    hero.append(eyebrow, title, description);

    const stats = document.createElement("section");
    stats.className = "stats-grid";

    [
      [t.participants.length, t.labels.participants],
      [t.format.type === "pokemon_swiss" ? "Suíço + Cut" : "Mata-mata", "Formato"],
      [`BO${t.format.finalBestOf}`, "Final"],
      [t.rules.length, "Seções de regras"]
    ].forEach(([value, label]) => {
      const card = document.createElement("article");
      card.className = "stat-card";

      const strong = document.createElement("strong");
      strong.textContent = value;

      const span = document.createElement("span");
      span.textContent = label;

      card.append(strong, span);
      stats.appendChild(card);
    });

    const previewGrid = document.createElement("section");
    previewGrid.className = "preview-grid";

    const rulesCard = document.createElement("article");
    rulesCard.className = "card preview-card";
    const rulesTitle = document.createElement("h3");
    rulesTitle.textContent = t.labels.rules;
    rulesCard.appendChild(rulesTitle);

    if (!t.rules.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Nenhuma regra cadastrada.";
      rulesCard.appendChild(p);
    } else {
      t.rules.slice(0, 4).forEach(rule => {
        const item = document.createElement("div");
        item.className = "preview-item";
        const strong = document.createElement("strong");
        strong.textContent = rule.title;
        const p = document.createElement("p");
        p.textContent = rule.content;
        item.append(strong, p);
        rulesCard.appendChild(item);
      });
    }

    const awardsCard = document.createElement("article");
    awardsCard.className = "card preview-card";
    const awardsTitle = document.createElement("h3");
    awardsTitle.textContent = t.labels.awards;
    awardsCard.appendChild(awardsTitle);

    if (!t.awards.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Nenhuma premiação cadastrada.";
      awardsCard.appendChild(p);
    } else {
      t.awards.slice(0, 4).forEach(award => {
        const item = document.createElement("div");
        item.className = "preview-item";
        const strong = document.createElement("strong");
        strong.textContent = award.title;
        const p = document.createElement("p");
        p.textContent = award.description;
        item.append(strong, p);
        awardsCard.appendChild(item);
      });
    }

    previewGrid.append(rulesCard, awardsCard);
    root.append(hero, stats, previewGrid);
  },

  renderAll() {
    App.updateEditorHeader();
    App.refreshLabels();
    App.renderOverview();
    App.renderRules();
    App.renderAwards();
    App.renderParticipants();
    App.renderBracket();
    App.renderHistory();
  }
};

window.addEventListener("DOMContentLoaded", App.init);
