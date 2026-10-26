document.addEventListener("DOMContentLoaded", async function () {
  const container = document.getElementById("housing-recommendations-container");
  const status = document.getElementById("housing-recommendations-status");
  const showAllButton = document.getElementById("show-all-housing-recommendations");
  if (!container || !status || !showAllButton) return;

  const columns = {
    name: "What is the name of your apartment complex or building?",
    neighborhood: "In which neighborhood is your apartment located?",
    rating: "How would you rate your overall experience living in this building?",
    commute: "On average, how far is your commute to the office? (minutes)",
    amenities: "Which of the following amenities are available?",
    comments: "Please provide any additional comments, tips, or advice for new hires considering this location."
  };
  const clean = value => String(value || "").trim();
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function labeledText(parent, label, text) {
    if (!text) return;
    const paragraph = element("p");
    paragraph.append(element("strong", label + ": "), document.createTextNode(text));
    parent.append(paragraph);
  }

  try {
    const response = await fetch("data/employee-housing-recommendations.csv", { cache: "no-store" });
    if (!response.ok) throw new Error("Housing CSV HTTP status: " + response.status);
    const parsed = Papa.parse(await response.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: header => header.replace(/^\uFEFF/, "").trim()
    });
    if (parsed.errors.length) throw new Error("Unable to parse housing CSV");
    if (!Object.values(columns).every(column => parsed.meta.fields.includes(column))) {
      throw new Error("Housing CSV is missing required columns");
    }

    const buildings = new Map();
    let count = 0;
    parsed.data.forEach(row => {
      const name = clean(row[columns.name]);
      if (!name) return;
      // Treat punctuation and the optional 'Apartments' suffix as the same building.
      const key = name.toLowerCase().replace(/\bapartments\b/g, "").replace(/[^a-z0-9]/g, "");
      if (!key) return;
      if (!buildings.has(key)) {
        buildings.set(key, { name, count: 0, ratings: [], neighborhoods: new Set(), commutes: new Set(), amenities: new Set(), comments: new Set() });
      }
      const building = buildings.get(key);
      building.count++;
      count++;
      const rating = Number(clean(row[columns.rating]));
      if (Number.isFinite(rating) && rating >= 1 && rating <= 5) building.ratings.push(rating);
      if (clean(row[columns.neighborhood])) building.neighborhoods.add(clean(row[columns.neighborhood]));
      if (clean(row[columns.commute])) building.commutes.add(clean(row[columns.commute]));
      clean(row[columns.amenities]).split(";").map(clean).filter(Boolean).forEach(item => building.amenities.add(item));
      const comment = clean(row["Comment summary"]) || clean(row[columns.comments]);
      if (comment) building.comments.add(comment);
    });

    const sorted = Array.from(buildings.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const featured = sorted.filter(building => building.count >= 2);
    let showAll = false;

    function render() {
      const visible = showAll ? sorted : featured;
      container.replaceChildren();
      visible.forEach(building => {
        const card = element("article", "", "recommendation-card housing-recommendation-card");
        card.append(element("h3", building.name));
        const badges = element("div", "", "tags");
        badges.append(element("span", building.count + (building.count === 1 ? " response" : " responses")));
        if (building.ratings.length) {
          const average = building.ratings.reduce((sum, rating) => sum + rating, 0) / building.ratings.length;
          badges.append(element("span", "Average rating: " + average.toFixed(1) + "/5"));
        }
        card.append(badges);
        labeledText(card, "Neighborhood", Array.from(building.neighborhoods).join("; "));
        labeledText(card, "Reported commute (minutes)", Array.from(building.commutes).join("; "));

        if (building.amenities.size) {
          const amenities = element("details", "", "housing-amenities");
          amenities.append(element("summary", "Reported amenities"), element("p", Array.from(building.amenities).join(", ")));
          card.append(amenities);
        }
        if (building.comments.size) {
          const details = element("details");
          details.append(element("summary", "What PMGers said (" + building.comments.size + ")"));
          details.append(element("p", "Feedback may be condensed for clarity."));
          const notes = element("ul");
          building.comments.forEach(comment => notes.append(element("li", comment)));
          details.append(notes);
          card.append(details);
        }
        container.append(card);
      });
      status.textContent = count
        ? "Showing " + visible.length + " of " + buildings.size + " communities" + (showAll ? ". " : " with at least 2 responses. ") + count + " survey responses total. Ratings are out of 5; commutes and amenities are reported by residents."
        : "No housing survey responses yet.";
      if (count && !visible.length) {
        container.append(element("p", "No communities have two responses yet. Select Show All Recommendations to see all survey results.", "recommendations-empty"));
      }
    }

    render();
    showAllButton.hidden = sorted.length === featured.length;
    showAllButton.addEventListener("click", function () {
      showAll = !showAll;
      render();
      showAllButton.setAttribute("aria-expanded", String(showAll));
      showAllButton.textContent = showAll ? "Show Only Communities with 2+ Responses" : "Show All Recommendations";
    });
  } catch (error) {
    console.error("Unable to load housing recommendations:", error);
    status.textContent = "Housing recommendations could not be loaded. Please try refreshing the page.";
  }
});
