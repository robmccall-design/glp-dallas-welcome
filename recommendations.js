document.addEventListener("DOMContentLoaded", async function () {
  const csvPath = "data/reccomendations.csv";

  const categories = [
    { key: "food", label: "Food", emoji: "🍔" },
    { key: "coffee", label: "Coffee", emoji: "☕" },
    { key: "bars", label: "Bars", emoji: "🍺" }
  ];

  const statusElement = document.getElementById("recommendations-status");
  const recommendationsContainer = document.getElementById(
    "recommendations-container"
  );
  const allRecommendationsContainer = document.getElementById(
    "all-recommendations"
  );
  const showAllButton = document.getElementById(
    "show-all-recommendations"
  );

  if (
    !statusElement ||
    !recommendationsContainer ||
    !allRecommendationsContainer ||
    !showAllButton
  ) {
    console.error(
      "Recommendations markup is missing one or more required elements."
    );
    return;
  }

  try {
    const response = await fetch(csvPath, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load ${csvPath}. HTTP status: ${response.status}`
      );
    }

    const csvText = await response.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: function (header) {
        return header.trim();
      }
    });

    if (parsed.errors.length > 0) {
      console.warn("CSV parsing warnings:", parsed.errors);
    }

    const surveyResponses = parsed.data
      .map(normalizeSurveyResponse)
      .filter(function (response) {
        return response.category && response.name;
      });

    const groupedRecommendations =
      aggregateRecommendations(surveyResponses);

    renderTopRecommendations(
      groupedRecommendations,
      categories,
      recommendationsContainer
    );

    renderFullList(
      groupedRecommendations,
      categories,
      allRecommendationsContainer
    );

    statusElement.hidden = true;

    const hasRecommendations = categories.some(function (category) {
      const recommendations =
        groupedRecommendations.get(category.key) || [];

      return recommendations.length > 0;
    });

    showAllButton.hidden = !hasRecommendations;
  } catch (error) {
    console.error("Unable to load recommendations:", error);

    statusElement.textContent =
      "Recommendations could not be loaded. Check the CSV path and column names.";
  }

  showAllButton.addEventListener("click", function () {
    const shouldOpen = allRecommendationsContainer.hidden;

    allRecommendationsContainer.hidden = !shouldOpen;

    showAllButton.textContent = shouldOpen
      ? "Hide full list"
      : "View all recommendations";

    showAllButton.setAttribute(
      "aria-expanded",
      String(shouldOpen)
    );

    if (shouldOpen) {
      allRecommendationsContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });

  function normalizeSurveyResponse(row) {
    return {
      category: normalizeCategory(row["Category"]),
      name: cleanText(row["Recommendation"]),
      location: cleanText(row["Location"]),
      notes: cleanText(row["Notes"]),
      website: cleanUrl(row["Website"])
    };
  }

  function normalizeCategory(value) {
    const normalized = cleanText(value).toLowerCase();

    const aliases = {
      food: "food",
      restaurant: "food",
      restaurants: "food",
      coffee: "coffee",
      cafe: "coffee",
      café: "coffee",
      cafes: "coffee",
      cafés: "coffee",
      bar: "bars",
      bars: "bars"
    };

    return aliases[normalized] || "";
  }

  function aggregateRecommendations(responses) {
    const grouped = new Map([
      ["food", new Map()],
      ["coffee", new Map()],
      ["bars", new Map()]
    ]);

    responses.forEach(function (response) {
      const categoryMap = grouped.get(response.category);

      if (!categoryMap) {
        return;
      }

      const recommendationKey = [
        normalizeName(response.name),
        normalizeName(response.location)
      ].join("|");

      if (!categoryMap.has(recommendationKey)) {
        categoryMap.set(recommendationKey, {
          name: response.name,
          location: response.location,
          website: response.website,
          count: 0,
          notes: new Set()
        });
      }

      const recommendation =
        categoryMap.get(recommendationKey);

      recommendation.count += 1;

      if (response.notes) {
        recommendation.notes.add(response.notes);
      }

      if (!recommendation.website && response.website) {
        recommendation.website = response.website;
      }
    });

    const results = new Map();

    grouped.forEach(function (categoryMap, category) {
      const rankedRecommendations = Array.from(
        categoryMap.values()
      )
        .map(function (recommendation) {
          return {
            ...recommendation,
            notes: Array.from(recommendation.notes)
          };
        })
        .sort(function (a, b) {
          if (b.count !== a.count) {
            return b.count - a.count;
          }

          return a.name.localeCompare(b.name);
        });

      results.set(category, rankedRecommendations);
    });

    return results;
  }

  function renderTopRecommendations(
    grouped,
    categoryConfig,
    container
  ) {
    container.replaceChildren();

    categoryConfig.forEach(function (category) {
      const recommendations =
        grouped.get(category.key) || [];

      const section = document.createElement("section");
      section.className = "recommendation-category";

      const heading = document.createElement("h2");
      heading.className = "recommendation-category-title";
      heading.textContent =
        `${category.emoji} ${category.label}`;

      section.appendChild(heading);

      if (recommendations.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "recommendations-empty";
        emptyMessage.textContent = "Coming soon...";

        section.appendChild(emptyMessage);
      } else {
        const grid = document.createElement("div");
        grid.className = "recommendations-grid";

        const card = document.createElement("article");
card.className = "recommendation-card";

const list = document.createElement("ol");
list.className = "recommendation-list";

recommendations
  .slice(0, 3)
  .forEach(function (recommendation) {

    const item = document.createElement("li");

    const link = document.createElement(
      recommendation.website ? "a" : "span"
    );

    link.className = "recommendation-name";

    if (recommendation.website) {
      link.href = recommendation.website;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    link.textContent = recommendation.name;

    const count = document.createElement("span");
    count.className = "recommendation-count";
    count.textContent =
      `${recommendation.count} PMGer${recommendation.count === 1 ? "" : "s"}`;

    item.append(link, count);

    list.appendChild(item);

  });

card.appendChild(list);
section.appendChild(card);

}

      container.appendChild(section);
    });
  }

  function renderFullList(
  grouped,
  categoryConfig,
  container
) {
  container.replaceChildren();

  const heading = document.createElement("h2");
  heading.className = "all-recommendations-title";
  heading.textContent = "All PMGer Recommendations";

  const tabs = document.createElement("div");
  tabs.className = "recommendation-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Recommendation categories");

  const panels = document.createElement("div");
  panels.className = "recommendation-tab-panels";

  const availableCategories = categoryConfig.filter(function (category) {
    const recommendations = grouped.get(category.key) || [];
    return recommendations.length > 0;
  });

  availableCategories.forEach(function (category, index) {
    const recommendations = grouped.get(category.key) || [];

    const tabId = `recommendation-tab-${category.key}`;
    const panelId = `recommendation-panel-${category.key}`;

    const tab = document.createElement("button");

    tab.type = "button";
    tab.className = "recommendation-tab";
    tab.id = tabId;

    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panelId);

    tab.setAttribute(
      "aria-selected",
      index === 0 ? "true" : "false"
    );

    tab.tabIndex = index === 0 ? 0 : -1;

    tab.textContent =
      `${category.emoji} ${category.label}`;

    const panel = document.createElement("section");

    panel.className = "recommendation-tab-panel";
    panel.id = panelId;

    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tabId);

    panel.hidden = index !== 0;

    const list = document.createElement("div");
    list.className = "full-recommendations-list";

    recommendations.forEach(function (
      recommendation,
      recommendationIndex
    ) {
      list.appendChild(
        createFullRecommendation(
          recommendation,
          recommendationIndex + 1
        )
      );
    });

    panel.appendChild(list);

    tabs.appendChild(tab);
    panels.appendChild(panel);

    tab.addEventListener("click", function () {

      tabs
        .querySelectorAll(".recommendation-tab")
        .forEach(function (button) {
          button.setAttribute(
            "aria-selected",
            "false"
          );

          button.tabIndex = -1;
        });

      panels
        .querySelectorAll(".recommendation-tab-panel")
        .forEach(function (tabPanel) {
          tabPanel.hidden = true;
        });

      tab.setAttribute(
        "aria-selected",
        "true"
      );

      tab.tabIndex = 0;

      panel.hidden = false;
    });
  });

  container.append(
    heading,
    tabs,
    panels
  );
}
  function createFullRecommendation(
    recommendation,
    rank
  ) {
    const item = document.createElement("article");
    item.className = "full-recommendation-item";

    const rankElement = document.createElement("div");
    rankElement.className = "full-recommendation-rank";
    rankElement.textContent = rank;

    const content = document.createElement("div");
    content.className = "full-recommendation-content";

    const header = document.createElement("div");
    header.className = "full-recommendation-header";

    const title = document.createElement("h4");
    appendRecommendationLink(title, recommendation);

    const badge = document.createElement("span");
    badge.className = "recommendation-count-badge";
    badge.textContent = formatRecommendationCount(
      recommendation.count
    );

    header.append(title, badge);
    content.appendChild(header);

    if (recommendation.location) {
      const location = document.createElement("p");
      location.className = "recommendation-location";
      location.textContent = recommendation.location;

      content.appendChild(location);
    }

    if (recommendation.notes.length > 0) {
      const details = document.createElement("details");
      details.className = "recommendation-notes-details";

      const summary = document.createElement("summary");
      summary.textContent =
        `What PMGers said (${recommendation.notes.length})`;

      const notesList = document.createElement("ul");
      notesList.className = "recommendation-notes";

      recommendation.notes.forEach(function (note) {
        const listItem = document.createElement("li");
        listItem.textContent = note;
        notesList.appendChild(listItem);
      });

      details.append(summary, notesList);
      content.appendChild(details);
    }

    item.append(rankElement, content);

    return item;
  }

  function appendRecommendationLink(
    parent,
    recommendation
  ) {
    if (!recommendation.website) {
      parent.textContent = recommendation.name;
      return;
    }

    const link = document.createElement("a");
    link.href = recommendation.website;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = recommendation.name;

    parent.appendChild(link);
  }

  function formatRecommendationCount(count) {
  return `${count}`;
}

  function normalizeName(value) {
    return cleanText(value)
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function cleanText(value) {
    return String(value || "").trim();
  }

  function cleanUrl(value) {
    const url = cleanText(value);

    if (!url) {
      return "";
    }

    try {
      const parsedUrl = new URL(url);

      if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
      ) {
        return "";
      }

      return parsedUrl.href;
    } catch {
      return "";
    }
  }
});