// -------------------------------
// 1. Load all datasets
// -------------------------------
async function fetchData() {
  const [
    cleaned_full_data,
    doordash_data,
    google_trends,
    time_series_worldwide
  ] = await Promise.all([
    d3.csv("./datasets/cleaned_full_data.csv", d3.autoType),
    d3.csv("./datasets/doordash_data.csv", d3.autoType),
    d3.csv("./datasets/google_trends.csv", d3.autoType),
    d3.csv("./datasets/time_series_Worldwide_20131231-1600_20260401-2321.csv", d3.autoType)
  ]);

  return {
    cleaned_full_data,
    doordash_data,
    google_trends,
    time_series_worldwide
  };
}

// -------------------------------
// 2. Initialize dashboard
// -------------------------------
async function initDashboard() {
  try {
    const {
      cleaned_full_data,
      doordash_data,
      google_trends,
      time_series_worldwide
    } = await fetchData();

    // -------------------------------
    // 3. Call each chart function
    // -------------------------------
    timeSeriesChart(time_series_worldwide, "#vis_1");
    timeOfDayChart(doordash_data, "#vis_2b");
    scatterSelection(cleaned_full_data, "#vis_3");
    sentimentChart(google_trends, "#vis_4");
    totalOrdersChart(doordash_data, "#vis_5");
    stackedCityChart(cleaned_full_data, "#vis_6");

  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
}

// -------------------------------
// 4. Start the dashboard
// -------------------------------
initDashboard();







function timeSeriesChart(time_series_worldwide, selector) {
  const data = time_series_worldwide;
  
  // Parse dates and fold data for "Food delivery" track
  const processedData = data.map(d => ({
    Time: new Date(d.Time),
    TimeStr: new Date(d.Time).toISOString().slice(0, 10),
    Value: parseFloat(d["Food delivery"])
  }));

  // Parse Uber Eats data for the actual peak
  const uberData = data.map(d => ({
    Time: new Date(d.Time),
    TimeStr: new Date(d.Time).toISOString().slice(0, 10),
    Value: parseFloat(d["Uber Eats"])
  }));

  const uberPeakIndex = uberData.reduce((maxIdx, d, idx) => 
    d.Value > uberData[maxIdx].Value ? idx : maxIdx, 0);
  const uberPeak = uberData[uberPeakIndex];

  const allKeywords = ["Food delivery", "Uber Eats", "DoorDash", "Grubhub"];

  const keywordPeakInfo = allKeywords.map(keyword => {
    const keywordRows = data.map(d => ({
      Time: new Date(d.Time),
      TimeStr: new Date(d.Time).toISOString().slice(0, 10),
      Value: parseFloat(d[keyword])
    }));

    const peakIndex = keywordRows.reduce((maxIdx, row, idx) =>
      row.Value > keywordRows[maxIdx].Value ? idx : maxIdx, 0);

    return {
      keyword,
      ...keywordRows[peakIndex]
    };
  });

  const container = document.querySelector(selector);
  container.innerHTML = "";

  // Create wrapper div
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";

  // Create instruction panel
  const instructionPanel = document.createElement("div");
  instructionPanel.style.marginBottom = "20px";
  instructionPanel.style.padding = "15px";
  instructionPanel.style.backgroundColor = "#FFF8E1";
  instructionPanel.style.borderLeft = "4px solid #FF6B35";
  instructionPanel.style.borderRadius = "4px";

  const instruction = document.createElement("p");
  instruction.textContent = "Click anywhere on the graph to predict the peak of all Food Delivery search interest.";
  instruction.style.margin = "0 0 15px 0";
  instruction.style.fontSize = "14px";
  instruction.style.color = "#333";

  instructionPanel.appendChild(instruction);

  // Create container for button and selection feedback
  const actionContainer = document.createElement("div");
  actionContainer.style.display = "flex";
  actionContainer.style.alignItems = "center";
  actionContainer.style.gap = "20px";

  // Create button inside action container
  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Submit Prediction";
  submitBtn.style.padding = "10px 20px";
  submitBtn.style.backgroundColor = "#CCCCCC";
  submitBtn.style.color = "#999999";
  submitBtn.style.border = "none";
  submitBtn.style.borderRadius = "4px";
  submitBtn.style.cursor = "pointer";
  submitBtn.style.fontSize = "14px";
  submitBtn.style.fontWeight = "bold";
  submitBtn.style.transition = "all 0.3s ease";
  submitBtn.disabled = true;
  submitBtn.style.opacity = "1";

  submitBtn.addEventListener("mouseover", function() {
    if (!this.disabled) {
      this.style.backgroundColor = "#E55100";
      this.style.transform = "scale(1.05)";
    }
  });

  submitBtn.addEventListener("mouseout", function() {
    if (!this.disabled) {
      this.style.backgroundColor = "#FF6B35";
      this.style.transform = "scale(1)";
    }
  });

  actionContainer.appendChild(submitBtn);

  // Create selection feedback element (initially hidden)
  const selectionFeedback = document.createElement("span");
  selectionFeedback.style.fontSize = "13px";
  selectionFeedback.style.color = "#000";
  selectionFeedback.style.fontWeight = "bold";
  selectionFeedback.style.display = "none";
  selectionFeedback.style.alignItems = "center";
  selectionFeedback.style.display = "inline-flex";
  selectionFeedback.style.gap = "8px";
  actionContainer.appendChild(selectionFeedback);

  instructionPanel.appendChild(actionContainer);
  wrapper.appendChild(instructionPanel);

  // State
  let userMarker = null;
  let formSubmitted = false;
  const chartData = processedData.map(d => ({ 
    TimeStr: d.TimeStr, 
    Value: d.Value
  }));

  // Prepare data for final chart with all four keywords
  const chartDataAllKeywords = [];
  
  data.forEach(row => {
    allKeywords.forEach(keyword => {
      chartDataAllKeywords.push({
        TimeStr: new Date(row.Time).toISOString().slice(0, 10),
        Keyword: keyword,
        Value: parseFloat(row[keyword])
      });
    });
  });

  // Blank chart spec - empty axes only, no data visible
  const blankSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 900,
    height: 450,
    padding: { left: 50, right: 30, top: 20, bottom: 50 },
    data: { values: chartData },
    mark: "point",
    encoding: {
      x: { field: "TimeStr", type: "temporal", axis: { title: "Year" } },
      y: { field: "Value", type: "quantitative", scale: { domain: [0, 100] }, axis: { title: "Search Interest" } }
    },
    layer: [
      {
        mark: { type: "point", size: 0, opacity: 0 },
        encoding: {
          x: { field: "TimeStr", type: "temporal" },
          y: { field: "Value", type: "quantitative" }
        }
      }
    ]
  };

  // Chart with user's prediction highlighted
  const predictionSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 900,
    height: 450,
    padding: { left: 50, right: 30, top: 20, bottom: 50 },
    data: { values: chartData },
    layer: [
      {
        mark: { type: "line", color: "#CCCCCC", size: 2, opacity: 0.4 },
        encoding: {
          x: { field: "TimeStr", type: "temporal", axis: { title: "Year" } },
          y: { field: "Value", type: "quantitative", scale: { domain: [0, 100] }, axis: { title: "Search Interest" } }
        }
      },
      {
        mark: { type: "point", size: 150, color: "#CCCCCC", opacity: 0.5, cursor: "pointer" },
        encoding: {
          x: { field: "TimeStr", type: "temporal" },
          y: { field: "Value", type: "quantitative" },
          tooltip: [
            { field: "TimeStr", type: "temporal", title: "Date" },
            { field: "Value", type: "quantitative", title: "Search Interest" }
          ]
        }
      },
      {
        mark: { type: "point", size: 250, color: "#FF6B35", opacity: 1 },
        transform: [
          { filter: { field: "TimeStr", equal: "" } }
        ],
        encoding: {
          x: { field: "TimeStr", type: "temporal" },
          y: { field: "Value", type: "quantitative" }
        }
      }
    ]
  };

  // Final chart spec with revealed data and peak annotation
  const finalSpec = {
    $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    width: 900,
    height: 450,
    padding: { left: 50, right: 30, top: 20, bottom: 50 },
    data: { values: chartDataAllKeywords },
    layer: [
      {
        mark: { type: "line", size: 2, point: true },
        encoding: {
          x: { field: "TimeStr", type: "temporal", axis: { title: "Year" } },
          y: { field: "Value", type: "quantitative", scale: { domain: [0, 100] }, axis: { title: "Search Interest" } },
          color: { 
            field: "Keyword", 
            type: "nominal",
            scale: {
              domain: allKeywords,
              range: ["#A096BB", "#6A9767", "#E9AB7F", "#88B9CF"]
            },
            legend: {
              title: "Platform",
              orient: "bottom",
              direction: "horizontal",
              columns: 4,
              padding: 10
            }
          }
        }
      },
      {
        mark: { type: "point", size: 200, opacity: 1 },
        transform: [
          { filter: { field: "TimeStr", equal: uberPeak.TimeStr } },
          { filter: { field: "Keyword", equal: "Uber Eats" } }
        ],
        encoding: {
          x: { field: "TimeStr", type: "temporal" },
          y: { field: "Value", type: "quantitative" },
          color: { value: "#6A9767" }
        }
      },
      {
        mark: { type: "text", align: "center", baseline: "bottom", dy: -18, fontSize: 13, fontWeight: "bold", fill: "#6A9767" },
        transform: [
          { filter: { field: "TimeStr", equal: uberPeak.TimeStr } },
          { filter: { field: "Keyword", equal: "Uber Eats" } }
        ],
        encoding: {
          x: { field: "TimeStr", type: "temporal" },
          y: { field: "Value", type: "quantitative" },
          text: { value: `Uber Eats Peak: ${uberPeak.Value} (${uberPeak.Time.toLocaleDateString("en-US", { month: "short", year: "numeric" })})` }
        }
      }
    ]
  };

  // Create chart container
  const chartContainer = document.createElement("div");
  chartContainer.style.marginBottom = "20px";
  wrapper.appendChild(chartContainer);

  // Container for results (below chart)
  const resultsContainer = document.createElement("div");
  resultsContainer.style.marginTop = "20px";
  resultsContainer.style.paddingTop = "20px";
  resultsContainer.style.paddingBottom = "20px";
  wrapper.appendChild(resultsContainer);

  // Render blank chart first
  vegaEmbed(chartContainer, blankSpec, { actions: false }).then(result => {
    const vegaView = result.view;

    // Add click handler directly to the SVG/canvas element
    const chartElement = chartContainer.querySelector("canvas") || chartContainer.querySelector("svg");
    
    if (chartElement) {
      chartElement.addEventListener("click", (event) => {
        if (formSubmitted) return;

        const rect = chartElement.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const xScale = vegaView.scale("x");
        const yScale = vegaView.scale("y");
        const padding = { left: 50, right: 30, top: 20, bottom: 50 };
        const chartHeight = 450 - padding.top - padding.bottom;
        const clickYInner = clickY - padding.top;

        let clickedValue;
        if (yScale && typeof yScale.invert === "function") {
          clickedValue = yScale.invert(clickYInner);
        }

        const predictedValue = Math.round(Math.max(0, Math.min(100, (clickedValue != null ? clickedValue : (1 - clickYInner / chartHeight) * 100))));

        let minDist = Infinity;
        let closestPoint = null;

        if (xScale && typeof xScale === "function") {
          processedData.forEach(point => {
            const pointX = xScale(point.Time);
            if (typeof pointX !== "number" || Number.isNaN(pointX)) return;
            const dist = Math.abs(pointX - clickX);
            if (dist < minDist) {
              minDist = dist;
              closestPoint = point;
            }
          });
        }

        if (!closestPoint) {
          const chartWidth = 900 - padding.left - padding.right;
          const clickXInner = clickX - padding.left;
          const xNorm = clickXInner / chartWidth;

          processedData.forEach((point, idx) => {
            const pointXNorm = idx / (processedData.length - 1);
            const dist = Math.abs(pointXNorm - xNorm);
            if (dist < minDist) {
              minDist = dist;
              closestPoint = point;
            }
          });
        }

        if (closestPoint) {
          userMarker = {
            Time: closestPoint.Time,
            TimeStr: closestPoint.TimeStr,
            Value: predictedValue
          };
          
          // Create prediction spec with user's marker visible
          const predictionSpecWithMarker = {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            width: 900,
            height: 450,
            padding: { left: 50, right: 30, top: 20, bottom: 50 },
            data: { values: chartData },
            layer: [
              {
                mark: { type: "point", size: 0, opacity: 0 },
                encoding: {
                  x: { field: "TimeStr", type: "temporal", axis: { title: "Year" } },
                  y: { field: "Value", type: "quantitative", scale: { domain: [0, 100] }, axis: { title: "Search Interest" } }
                }
              },
              {
                data: { values: [{ TimeStr: closestPoint.TimeStr, Value: predictedValue }] },
                mark: { type: "image", width: 40, height: 40, aspect: true },
                encoding: {
                  x: { field: "TimeStr", type: "temporal" },
                  y: { field: "Value", type: "quantitative" },
                  url: { value: "assets/images/scooter.png" }
                }
              }
            ]
          };

          vegaEmbed(chartContainer, predictionSpecWithMarker, { actions: false });

          submitBtn.disabled = false;
          submitBtn.style.backgroundColor = "#FF6B35";
          submitBtn.style.color = "white";
          submitBtn.style.opacity = "1";
          submitBtn.style.cursor = "pointer";

          // Visual feedback - show selected point
          selectionFeedback.innerHTML = `<img src="assets/images/scooter.png" alt="Selected" style="width: 18px; height: 18px;"> Selected: ${closestPoint.Time.toLocaleDateString("en-US", { month: "short", year: "numeric" })} (Score: ${predictedValue})`;
          selectionFeedback.style.display = "inline-flex";
        }
      });
    }

    // Submit button handler
    submitBtn.addEventListener("click", async () => {
      if (!userMarker) return;

      formSubmitted = true;
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.6";
      submitBtn.textContent = "Revealing actual data...";

      // Brief animation pause
      await new Promise(resolve => setTimeout(resolve, 800));

      // Embed final chart with data, peak annotation, and the selected marker image
      const finalSpecWithMarker = {
        ...finalSpec,
        layer: [
          ...finalSpec.layer,
          {
            data: { values: [userMarker] },
            mark: { type: "image", width: 40, height: 40, aspect: true },
            encoding: {
              x: { field: "TimeStr", type: "temporal" },
              y: { field: "Value", type: "quantitative" },
              url: { value: "assets/images/scooter.png" }
            }
          }
        ]
      };

      vegaEmbed(chartContainer, finalSpecWithMarker, { actions: false });

      // Show results as plain text
      resultsContainer.innerHTML = "";

      const userDate = userMarker.Time.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      const peakDate = uberPeak.Time.toLocaleDateString("en-US", { year: "numeric", month: "long" });
      const timeDiff = Math.abs(userMarker.Time - uberPeak.Time) / (1000 * 60 * 60 * 24 * 30); // months

      const closestPeak = keywordPeakInfo.reduce((best, current) => {
        const currentTimeDiff = Math.abs(userMarker.Time - current.Time) / (1000 * 60 * 60 * 24 * 30);
        const currentValueDiff = Math.abs(userMarker.Value - current.Value) / 100;
        const distance = currentTimeDiff + currentValueDiff;
        return (!best || distance < best.distance) ? { ...current, distance } : best;
      }, null);

      const resultText = document.createElement("p");
      resultText.style.fontSize = "14px";
      resultText.style.lineHeight = "1.6";
      resultText.style.color = "#333";

      if (userMarker.Value === uberPeak.Value && timeDiff < 1) {
        resultText.innerHTML = `<strong style="color: #2E7D32; font-size: 16px;">🎉 Perfect!</strong> You predicted the exact Uber Eats peak! It occurred in <strong>${peakDate}</strong> with a search interest score of <strong>${uberPeak.Value}</strong>.`;
      } else if (Math.abs(userMarker.Value - uberPeak.Value) <= 5 && timeDiff < 2) {
        resultText.innerHTML = `<br>
                            <strong>Your Prediction:</strong> ${userDate} (Score: ${userMarker.Value})<br>
                            <strong>Uber Eats Peak:</strong> ${peakDate} (Score: ${uberPeak.Value})`;
      } else {
        resultText.innerHTML = `<strong style="color: #E65100; font-size: 16px;">Results</strong><br>
                            <strong>Your Prediction:</strong> ${userDate} (Score: ${userMarker.Value})<br>
                            <strong>Uber Eats Peak:</strong> ${peakDate} (Score: ${uberPeak.Value})`;
      }

      const peaksList = document.createElement("div");
      peaksList.style.marginTop = "16px";
      peaksList.style.fontSize = "14px";
      peaksList.style.color = "#333";
      peaksList.innerHTML = keywordPeakInfo.map(info => {
        const peakMonth = info.Time.toLocaleDateString("en-US", { year: "numeric", month: "long" });
        const isClosest = closestPeak && info.keyword === closestPeak.keyword;
        return `<div style="margin-bottom: 8px;">
                  <span style="font-weight: ${isClosest ? "800" : "600"}; color: ${isClosest ? "#000" : "#444"};">${info.keyword}</span>: ${peakMonth} (Score: ${info.Value})${isClosest ? " <strong>← closest match</strong>" : ""}
                </div>`;
      }).join("");

      resultsContainer.appendChild(resultText);
      resultsContainer.appendChild(peaksList);
      submitBtn.style.display = "none";
    });
  }).catch(err => {
    console.error("Error embedding Vega-Lite chart:", err);
    chartContainer.innerHTML = `<p style="color: red;">Error loading chart: ${err.message}</p>`;
  });

  container.appendChild(wrapper);
}






function dayOfWeekChart(doordash_data, selector) {

  const data = doordash_data;

  const width = 800;
  const height = 500;
  const margin = {top: 20, right: 20, bottom: 40, left: 50};

  // Weekday names
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // Extract weekday
  const processed = data.map(d => {
    const date = new Date(d.created_at);
    const weekdayNum = date.getDay();
    return {
      weekdayNum,
      weekday: weekdays[weekdayNum]
    };
  });

  // Count orders per weekday
  const counts = d3.rollups(
    processed,
    v => v.length,
    d => d.weekday
  );

  // Convert to array
  const rows = counts.map(([weekday, count]) => ({ weekday, count }));

  // Sort Sun → Sat
  rows.sort((a, b) =>
    weekdays.indexOf(a.weekday) - weekdays.indexOf(b.weekday)
  );

  // Container
  const container = d3.create("div")
    .style("position", "relative");

  // Tooltip
  const tooltip = container.append("div")
    .style("position", "absolute")
    .style("padding", "12px 16px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("font-size", "14px")
    .style("opacity", 0)
    .style("width", "20vw")
    .style("max-width", "300px");

  // SVG
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("font", "10px sans-serif");

  // Scales
  const x = d3.scaleBand()
    .domain(weekdays)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d.count)]).nice()
    .range([height - margin.bottom, margin.top]);

  // Color scale
  const color = d3.scaleSequential()
    .domain([0, d3.max(rows, d => d.count)])
    .interpolator(d3.interpolateBlues);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("class", "axis-title axis-title-x")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .text("Day of Week");

  svg.append("text")
    .attr("class", "axis-title axis-title-y")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .text("Number of Orders");

  // Bars
  svg.append("g")
    .selectAll("rect")
    .data(rows)
    .join("rect")
      .attr("x", d => x(d.weekday))
      .attr("y", d => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", d => y(0) - y(d.count))
      .attr("fill", d => color(d.count))
      .on("pointerenter", function(event, d) {
        d3.select(this).attr("fill", "#1f77b4");

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>${d.weekday}</strong><br>
            Orders: ${d.count}
          `);
      })
      .on("pointermove", function(event) {
        const [xm, ym] = d3.pointer(event, container.node());
        tooltip
          .style("left", xm + 12 + "px")
          .style("top", ym - 28 + "px");
      })
      .on("pointerleave", function(event, d) {
        d3.select(this).attr("fill", color(d.count));
        tooltip.style("opacity", 0);
      });

  // ⭐ Append chart to the HTML element
  document.querySelector(selector).appendChild(container.node());
}






function timeOfDayChart(doordash_data, selector) {
  const data = doordash_data;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const timeRanges = [
    { key: "morning", label: "Morning", subtitle: "6am–12pm", hours: [6, 7, 8, 9, 10, 11], message: "You're a morning orderer — mornings are a popular time for people to grab delivery before the workday gets busy." },
    { key: "afternoon", label: "Afternoon", subtitle: "12pm–5pm", hours: [12, 13, 14, 15, 16], message: "You're an afternoon orderer — afternoons are a steady window of delivery activity as people refuel between meetings and errands." },
    { key: "evening", label: "Evening", subtitle: "5pm–9pm", hours: [17, 18, 19, 20], message: "You're an evening orderer — evenings are the busiest time of the week across the dataset." },
    { key: "latenight", label: "Late Night", subtitle: "9pm–2am", hours: [21, 22, 23, 0, 1], message: "You're a late-night orderer — late nights are a niche but strong period for delivery cravings." }
  ];

  const wrapper = document.createElement("div");
  wrapper.style.width = "100%";
  wrapper.style.maxWidth = "980px";
  wrapper.style.margin = "0 auto";
  wrapper.style.padding = "0 12px";
  wrapper.style.boxSizing = "border-box";

  const instructionPanel = document.createElement("div");
  instructionPanel.style.marginBottom = "20px";
  instructionPanel.style.padding = "15px";
  instructionPanel.style.backgroundColor = "#FFF8E1";
  instructionPanel.style.borderLeft = "4px solid #FF6B35";
  instructionPanel.style.borderRadius = "4px";

  const introText = document.createElement("p");
  introText.textContent = "Pick the time of day when you usually place food delivery orders, then submit to reveal the most popular times.";
  introText.style.margin = "0";
  introText.style.fontSize = "14px";
  introText.style.color = "#333";

  instructionPanel.appendChild(introText);

  const actionContainer = document.createElement("div");
  actionContainer.style.display = "flex";
  actionContainer.style.alignItems = "center";
  actionContainer.style.gap = "20px";
  actionContainer.style.marginTop = "14px";

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.textContent = "Submit";
  submitButton.disabled = true;
  submitButton.style.padding = "10px 20px";
  submitButton.style.backgroundColor = "#CCCCCC";
  submitButton.style.color = "#999999";
  submitButton.style.border = "none";
  submitButton.style.borderRadius = "4px";
  submitButton.style.cursor = "not-allowed";
  submitButton.style.fontSize = "14px";
  submitButton.style.fontWeight = "bold";
  submitButton.style.transition = "all 0.3s ease";
  submitButton.style.marginBottom = "0";
  submitButton.style.opacity = "1";

  actionContainer.appendChild(submitButton);
  instructionPanel.appendChild(actionContainer);
  wrapper.appendChild(instructionPanel);

  const buttonGrid = document.createElement("div");
  buttonGrid.style.display = "grid";
  buttonGrid.style.gridTemplateColumns = "repeat(auto-fit, minmax(190px, 1fr))";
  buttonGrid.style.gap = "14px";
  buttonGrid.style.marginBottom = "14px";

  const buttons = [];
  let selectedOption = null;

  submitButton.addEventListener("mouseover", () => {
    if (!submitButton.disabled) {
      submitButton.style.backgroundColor = "#E55100";
      submitButton.style.transform = "scale(1.05)";
    }
  });
  submitButton.addEventListener("mouseout", () => {
    if (!submitButton.disabled) {
      submitButton.style.backgroundColor = "#FF6B35";
      submitButton.style.transform = "scale(1)";
    }
  });

  function updateButtonStyle(button, isActive) {
    if (isActive) {
      button.style.backgroundColor = "#FFE0B2";
      button.style.color = "#BF360C";
      button.style.boxShadow = "0 16px 28px rgba(255, 138, 101, 0.24)";
    } else {
      button.style.backgroundColor = "#FFF3E0";
      button.style.color = "#4E342E";
      button.style.boxShadow = "0 8px 20px rgba(255, 152, 0, 0.12)";
    }
  }

  timeRanges.forEach((range, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.display = "flex";
    button.style.flexDirection = "column";
    button.style.alignItems = "flex-start";
    button.style.justifyContent = "center";
    button.style.padding = "18px 16px";
    button.style.border = "none";
    button.style.borderRadius = "18px";
    button.style.cursor = "pointer";
    button.style.minHeight = "90px";
    button.style.fontSize = "16px";
    button.style.fontWeight = "700";
    button.style.lineHeight = "1.2";
    button.style.textAlign = "left";
    button.style.transition = "all 0.2s ease";
    button.innerHTML = `${range.label}<span style="font-size: 13px; font-weight: 500; color: #5D4037; margin-top: 8px; display: block;">${range.subtitle}</span>`;

    updateButtonStyle(button, false);

    button.addEventListener("click", () => {
      selectedOption = range;
      buttons.forEach((otherButton, otherIndex) => {
        updateButtonStyle(otherButton, otherIndex === index);
      });
      submitButton.disabled = false;
      submitButton.style.backgroundColor = "#FF6B35";
      submitButton.style.color = "white";
      submitButton.style.opacity = "1";
      submitButton.style.cursor = "pointer";
    });

    buttons.push(button);
    buttonGrid.appendChild(button);
  });

  wrapper.appendChild(buttonGrid);

  const chartContainer = document.createElement("div");
  chartContainer.style.width = "100%";
  chartContainer.style.minHeight = "620px";
  chartContainer.style.marginTop = "28px";
  chartContainer.style.padding = "18px";
  chartContainer.style.borderRadius = "18px";
  chartContainer.style.overflow = "visible";
  chartContainer.style.backgroundColor = "#ffffff";
  chartContainer.style.boxShadow = "0 18px 45px rgba(0,0,0,0.08)";

  const messageContainer = document.createElement("p");
  messageContainer.style.marginTop = "18px";
  messageContainer.style.color = "#4E342E";
  messageContainer.style.fontSize = "15px";
  messageContainer.style.lineHeight = "1.6";
  messageContainer.style.display = "none";

  wrapper.appendChild(chartContainer);
  wrapper.appendChild(messageContainer);

  const container = document.querySelector(selector);
  container.innerHTML = "";
  container.appendChild(wrapper);

  const rawCounts = {};
  data.forEach(row => {
    const date = new Date(row.created_at);
    if (Number.isNaN(date.getTime())) return;
    const day = dayNames[date.getDay()];
    const hour = date.getHours();
    const key = `${day}-${hour}`;
    rawCounts[key] = (rawCounts[key] || 0) + 1;
  });

  const heatmapData = [];
  weekdayOrder.forEach(day => {
    hours.forEach(hour => {
      heatmapData.push({
        day,
        hour,
        count: rawCounts[`${day}-${hour}`] || 0
      });
    });
  });

  const maxCount = d3.max(heatmapData, d => d.count) || 1;

  function renderHeatmap() {
    if (!selectedOption) return;

    const selectedHours = selectedOption.hours;
    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      width: "container",
      height: 660,
      autosize: { type: "fit", contains: "padding" },
      data: { values: heatmapData },
      layer: [
        {
          mark: {
            type: "rect"
          },
          encoding: {
            x: {
              field: "day",
              type: "ordinal",
              sort: weekdayOrder,
              axis: {
                title: "Day of Week",
                labelAngle: 0,
                labelFontSize: 12,
                titleFontSize: 14,
                titleFontWeight: "700"
              }
            },
            y: {
              field: "hour",
              type: "ordinal",
              sort: hours,
              axis: {
                title: "Hour of Day",
                labelAngle: 0,
                labelFontSize: 12,
                titleFontSize: 14,
                titleFontWeight: "700",
                labelExpr: "datum.value + ':00'"
              }
            },
            color: {
              field: "count",
              type: "quantitative",
              scale: {
                domain: [0, maxCount],
                range: ["#fff3e0", "#ffb74d", "#fb8c00", "#d84315", "#b71c1c"]
              },
              legend: {
                title: "DoorDash orders by day of the week and time of day",
                titleFontSize: 13,
                labelFontSize: 12,
                orient: "bottom",
                direction: "horizontal",
                titleLimit: 600,
                labelLimit: 600
              }
            },
            tooltip: [
              { field: "day", type: "ordinal", title: "Day" },
              { field: "hour", type: "ordinal", title: "Hour", labelExpr: "datum.value + ':00'" },
              { field: "count", type: "quantitative", title: "Orders" }
            ]
          }
        },
        {
          mark: {
            type: "rect",
            fillOpacity: 0,
            stroke: "#000000",
            strokeWidth: 3,
            cornerRadius: 4
          },
          transform: [
            { filter: { field: "hour", oneOf: selectedHours } }
          ],
          encoding: {
            x: {
              field: "day",
              type: "ordinal",
              sort: weekdayOrder
            },
            y: {
              field: "hour",
              type: "ordinal",
              sort: hours
            }
          }
        }
      ]
    };

    vegaEmbed(chartContainer, spec, { actions: false }).then(() => {
      messageContainer.style.display = "block";
      messageContainer.innerHTML = `<strong style="color: #FF6B35;">${selectedOption.label}</strong><br>${selectedOption.message}`;
    }).catch(error => {
      chartContainer.innerHTML = `<p style="color: #D32F2F; padding: 18px;">Unable to load heatmap: ${error.message}</p>`;
    });
  }

  submitButton.addEventListener("click", renderHeatmap);
}







function scatterSelection(cleaned_full_data, selector) {

  const data = cleaned_full_data;

  const width = 1000;
  const height = 645;
  const marginTop = 20;
  const marginRight = 30;
  const marginBottom = 30;
  const marginLeft = 40;

  // Container
  const container = d3.create("div")
    .style("position", "relative");

  // Tooltip
  const tooltip = container.append("div")
    .style("position", "absolute")
    .style("padding", "6px 10px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("font-size", "12px")
    .style("opacity", 0);

  // SVG
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  // Scales
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.distance)]).nice()
    .range([marginLeft, width - marginRight]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.num_reviews)]).nice()
    .range([height - marginBottom, marginTop]);

  // Clip path
  svg.append("defs").append("clipPath")
    .attr("id", "clip-selection")
    .append("rect")
      .attr("x", marginLeft)
      .attr("y", marginTop)
      .attr("width", width - marginLeft - marginRight)
      .attr("height", height - marginTop - marginBottom);

  const dotLayer = svg.append("g")
    .attr("clip-path", "url(#clip-selection)");

  // Axes
  const gx = svg.append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x));

  const gy = svg.append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y));

// X‑axis title
  gx.append("text")
    .attr("x", width - 1)
    .attr("y", 28)
    .attr("fill", "#000")
    .attr("font-weight", "bold")
    .attr("text-anchor", "end")
    .text("Distance (Kilometers)");

  gy.select(".tick:last-of-type text").clone()
    .attr("x", 4)
    .attr("text-anchor", "start")
    .attr("font-weight", "bold")
    .text("Number of Reviews");

  // Precompute pixel positions
  const points = data.map(d => ({
    x: x(d.distance),
    y: y(d.num_reviews),
    d
  }));

  // Draw dots
  const dot = dotLayer.selectAll("circle")
    .data(points)
    .join("circle")
      .attr("r", 3)
      .attr("cx", p => p.x)
      .attr("cy", p => p.y)
      .attr("stroke", "steelblue")
      .attr("fill", "white")
      .attr("stroke-width", 1.5);

  // Hover dot
  const hoverDot = svg.append("g")
    .attr("display", "none");

  hoverDot.append("circle")
    .attr("r", 5)
    .attr("fill", "red");

  // Pointer events
  svg
    .on("pointerenter", () => hoverDot.attr("display", null))
    .on("pointermove", pointermoved)
    .on("pointerleave", pointerleft);

  function pointermoved(event) {
    const [xm, ym] = d3.pointer(event);

    const nearest = d3.least(points, p => Math.hypot(p.x - xm, p.y - ym));
    if (!nearest) return;

    hoverDot.attr("transform", `translate(${nearest.x},${nearest.y})`);

    dot
      .attr("stroke", p => p === nearest ? "red" : "#ccc")
      .attr("fill", p => p === nearest ? "red" : "white");

    tooltip
      .style("opacity", 1)
      .style("left", nearest.x + 12 + "px")
      .style("top", nearest.y - 28 + "px")
      .html(`
        <strong>${nearest.d.restaurant}</strong><br>
        Distance: ${nearest.d.distance}<br>
        Reviews: ${nearest.d.num_reviews}
      `);
  }

  function pointerleft() {
    hoverDot.attr("display", "none");
    dot.attr("stroke", "steelblue").attr("fill", "white");
    tooltip.style("opacity", 0);
  }

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .translateExtent([
      [marginLeft, marginTop],
      [width - marginRight, height - marginBottom]
    ])
    .extent([
      [marginLeft, marginTop],
      [width - marginRight, height - marginBottom]
    ])
    .on("zoom", zoomed);

  svg.call(zoom);

  function zoomed(event) {
    const zx = event.transform.rescaleX(x);
    const zy = event.transform.rescaleY(y);

    points.forEach(p => {
      p.x = zx(p.d.distance);
      p.y = zy(p.d.num_reviews);
    });

    dot
      .attr("cx", p => p.x)
      .attr("cy", p => p.y);

    gx.call(d3.axisBottom(zx));
    gy.call(d3.axisLeft(zy));
  }

  // Brush
  const brush = d3.brush()
    .on("start brush end", ({selection}) => {

      if (!selection) {
        dot.attr("stroke", "steelblue");
        return;
      }

      const [[x0, y0], [x1, y1]] = selection;

      const selected = points.filter(p =>
        x0 <= p.x && p.x < x1 &&
        y0 <= p.y && p.y < y1
      );

      dot.attr("stroke", p => selected.includes(p) ? "steelblue" : "#ccc");
    });

  svg.call(brush);

  // Append to DOM
  document.querySelector(selector).appendChild(container.node());
}






function sentimentChart(google_trends, selector) {

  const data = google_trends;

  const width = 1000;
  const height = 600;
  const margin = {top: 20, right: 20, bottom: 50, left: 60};

  // Convert sentiment to numeric + label
  const processed = data.map(d => {
    const s = +d.sentiment;
    return {
      Apps: d.Apps,
      sentimentNum: s,
      sentimentLabel:
        s === 1 ? "Positive" :
        s === 0 ? "Neutral" :
        "Negative"
    };
  });

  // Count rows per (App, sentimentLabel)
  const grouped = d3.rollups(
    processed,
    v => v.length,
    d => d.Apps,
    d => d.sentimentLabel
  );

  // Flatten
  const rows = [];
  for (const [app, sentiments] of grouped) {
    for (const [label, count] of sentiments) {
      rows.push({ Apps: app, sentimentLabel: label, sentimentCount: count });
    }
  }

  // Unique apps
  const apps = Array.from(new Set(rows.map(d => d.Apps)));

  // Sentiment order
  const sentiments = ["Negative", "Neutral", "Positive"];

  // Container
  const container = d3.create("div")
    .style("position", "relative");

  // Tooltip
  const tooltip = container.append("div")
    .style("position", "absolute")
    .style("padding", "14px 18px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("pointer-events", "none")
    .style("font-size", "15px")
    .style("width", "22vw")
    .style("max-width", "320px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("opacity", 0);

  // SVG
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("font", "10px sans-serif");

  // Scales
  const x0 = d3.scaleBand()
    .domain(apps)
    .range([margin.left, width - margin.right])
    .paddingInner(0.2);

  const x1 = d3.scaleBand()
    .domain(sentiments)
    .range([0, x0.bandwidth()])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d.sentimentCount)]).nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(sentiments)
    .range(["#d62728", "#aaaaaa", "#2ca02c"]); // red, gray, green

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x0));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("class", "axis-title axis-title-x")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .text("Platform");

  svg.append("text")
    .attr("class", "axis-title axis-title-y")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 8)
    .text("Sentiment Score");


  // Bars
  svg.append("g")
    .selectAll("g")
    .data(apps)
    .join("g")
      .attr("transform", d => `translate(${x0(d)},0)`)
    .selectAll("rect")
    .data(app => rows.filter(r => r.Apps === app))
    .join("rect")
      .attr("x", d => x1(d.sentimentLabel))
      .attr("y", d => y(d.sentimentCount))
      .attr("width", x1.bandwidth())
      .attr("height", d => y(0) - y(d.sentimentCount))
      .attr("fill", d => color(d.sentimentLabel))
      .on("pointerenter", function(event, d) {
        d3.select(this).attr("fill", "#1f77b4");

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>App:</strong> ${d.Apps}<br>
            <strong>Sentiment:</strong> ${d.sentimentLabel}<br>
            <strong>Count:</strong> ${d.sentimentCount}
          `);
      })
      .on("pointermove", function(event) {
        const [xm, ym] = d3.pointer(event, container.node());
        tooltip
          .style("left", xm + 12 + "px")
          .style("top", ym - 28 + "px");
      })
      .on("pointerleave", function(event, d) {
        d3.select(this).attr("fill", color(d.sentimentLabel));
        tooltip.style("opacity", 0);
      });

  // ⭐ Append to HTML
  document.querySelector(selector).appendChild(container.node());
}






function totalOrdersChart(doordash_data, selector) {

  const categories = [
    "American",
    "Pizza",
    "Mexican",
    "Burger",
    "Sandwich",
    "Chinese",
    "Japanese",
    "Dessert",
    "Fast Food",
    "Indian"
  ];

  // ---------- FIX CATEGORY MATCHING ----------
  const normalize = d =>
    d.toLowerCase().replace(/\s+/g, " ").trim();

  const counts = d3.rollups(
    doordash_data.filter(d => d.store_primary_category),
    v => v.length,
    d => normalize(d.store_primary_category)
  );

  const countMap = new Map(counts);
  
  const chartData = categories.map(category => {
    const key =
      category === "Fast Food"
        ? "fast"
        : normalize(category);

    return {
      category,
      count: countMap.get(key) ?? 0
    };
  });

  const shuffledIndices = d3.shuffle(d3.range(chartData.length));

  const rankedData = [...chartData].sort((a, b) => b.count - a.count);
  const categoryRank = new Map(rankedData.map((d, i) => [d.category, i]));

  // ---------- LAYOUT ----------
  const width = 1000;
  const height = 600;

  const startRadius = 44;

  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(chartData, d => d.count)])
    .range([30, 70]);

  const colorScale = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => d.count)])
    .range(["#FFB556", "#B71C1C"]);

  // Two-row guess layout
  const cols = Math.ceil(chartData.length / 2);
  const colSpacing = (width - 160) / cols;
  const rowY = [height * 0.35, height * 0.65];

  const initialPositions = shuffledIndices.map((_, i) => ({
    x: 80 + (i % cols) * colSpacing,
    y: rowY[Math.floor(i / cols)]
  }));

  // ---------- CONTAINER ----------
  const wrapper = d3.create("div")
    .style("margin", "0")
    .style("padding", "0");

  const actionRow = wrapper.append("div")
    .style("margin-bottom", "20px")
    .style("padding", "15px")
    .style("background-color", "#FFF8E1")
    .style("border-left", "4px solid #FF6B35")
    .style("border-radius", "4px")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "18px");

  const counterText = actionRow.append("div")
    .style("font-size", "14px")
    .style("font-weight", "600")
    .text("0 of 5 selected");

  const submitButton = actionRow.append("button")
    .attr("disabled", true)
    .style("padding", "10px 20px")
    .style("border-radius", "4px")
    .style("border", "none")
    .style("font-weight", "bold")
    .style("font-size", "14px")
    .style("cursor", "not-allowed")
    .style("background", "#CCCCCC")
    .style("color", "#999999")
    .style("transition", "all 0.3s ease")
    .style("opacity", "1")
    .text("Submit Prediction");

  const svg = wrapper.append("svg")
    .attr("width", width)
    .attr("height", height);

  // ---------- STATE ----------
  const state = {
    selected: [],
    selectedSet: new Set(),
    submitted: false
  };

  const bubbles = svg.append("g");

  const bubbleGroups = bubbles.selectAll("g.bubble")
    .data(chartData)
    .join("g")
    .attr("class", "bubble")
    
    .attr("transform", (d, i) => {
      const shuffledIndex = shuffledIndices.indexOf(i);
      return `translate(
        ${initialPositions[shuffledIndex].x},
        ${initialPositions[shuffledIndex].y}
      )`;
    })

    .style("cursor", "pointer")
    .on("click", (_, d) => {
      if (state.submitted) return;

      const isSelected = state.selectedSet.has(d.category);

      if (isSelected) {
        state.selectedSet.delete(d.category);
        state.selected = state.selected.filter(c => c !== d.category);
      } else if (state.selected.length < 5) {
        state.selected.push(d.category);
        state.selectedSet.add(d.category);
      }

      updateSelectionUI();
    });

  // ---------- INITIAL GREY CIRCLES ----------
  bubbleGroups.append("circle")
    .attr("r", startRadius)
    .attr("fill", "#E0E0E0")
    .attr("stroke", "#BDBDBD")
    .attr("stroke-width", 1.6);

  // ---------- CATEGORY LABEL ----------
  bubbleGroups.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "12px")
    .style("font-weight", "700")
    .style("fill", "#3E2723")
    .style("pointer-events", "none")
    .text(d => d.category);

  // ---------- SELECTION BADGES ----------
  const badges = bubbleGroups.append("g")
    .attr("transform", `translate(${startRadius - 6},${-startRadius + 6})`)
    .style("display", "none");

  badges.append("circle")
    .attr("r", 14)
    .attr("fill", "#FF6B35")
    .attr("stroke", "#fff")
    .attr("stroke-width", 3);

  const badgeText = badges.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("fill", "#fff")
    .style("font-size", "12px")
    .style("font-weight", "800");

  // ---------- UI UPDATES ----------
  function updateSelectionUI() {
    counterText.text(`${state.selected.length} of 5 selected`);

    badges
      .style("display", d =>
        state.selectedSet.has(d.category) ? "block" : "none"
      )
      .select("text")
      .text(d => state.selected.indexOf(d.category) + 1);

    bubbleGroups.select("circle")
      .attr("stroke", d =>
        state.selectedSet.has(d.category) ? "#FF6B35" : "#BDBDBD"
      )
      .attr("stroke-width", d =>
        state.selectedSet.has(d.category) ? 3.5 : 1.6
      );

    submitButton
      .attr("disabled", state.selected.length !== 5 ? true : null)
      .style("cursor", state.selected.length === 5 ? "pointer" : "not-allowed")
      .style("background", state.selected.length === 5 ? "#FF6B35" : "#CCCCCC")
      .style("color", state.selected.length === 5 ? "#ffffff" : "#999999");
  }

  // ---------- SUBMIT / REVEAL ----------
  submitButton.on("click", () => {
    if (state.submitted) return;
    state.submitted = true;

    submitButton.text("Revealing…").attr("disabled", true);

    
    const perRow = Math.ceil(chartData.length / 2);
    const xSpacing = (width - 160) / perRow;

    const finalRowY = [
      height * 0.4,
      height * 0.65
    ];

    bubbleGroups.transition()
      .duration(1200)
      .attr("transform", d => {
        const rank = categoryRank.get(d.category);
        const row = Math.floor(rank / perRow);
        const col = rank % perRow;

        return `translate(
          ${80 + col * xSpacing},
          ${finalRowY[row]}
        )`;
      });
        
    bubbleGroups.select("circle")
      .transition()
      .duration(1200)
      .attr("r", d => Math.max(startRadius, radiusScale(d.count)))
      .attr("fill", d => colorScale(d.count))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2);

    bubbleGroups.select("text")
      .transition()
      .duration(600)
      .style("fill", "#ffffff");

    bubbleGroups.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.6em")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#ffffff")
      .style("pointer-events", "none")
      .text(d => d.count.toLocaleString());
  });

  // ---------- APPEND ----------
  const target = document.querySelector(selector);
  target.innerHTML = "";
  target.appendChild(wrapper.node());
}



function stackedCityChart(cleaned_full_data, selector) {

  const width = 800;
  const height = 350;
  const margin = {top: 20, right: 20, bottom: 60, left: 70};

  // --- RAW DATA ---
  const raw = cleaned_full_data;

  // --- ALLOWED CATEGORIES ---
  const allowedCategories = new Set([
    "Chinese",
    "Japanese",
    "Italian",
    "Burgers",
    "India",
    "Mexican",
    "Pizza",
    "American"
  ]);

  // --- COUNT ORDERS PER (CITY, CATEGORY) ---
  const grouped = d3.rollups(
    raw,
    v => v.length,
    d => d.city,
    d => d.category_1
  );

  // Extract city list
  const cities = Array.from(grouped, ([city]) => city);

  // Extract only allowed categories
  let categories = Array.from(
    new Set(raw.map(d => d.category_1))
  ).filter(cat => allowedCategories.has(cat));

  // --- BUILD STACK-FRIENDLY ROWS ---
  let rows = cities.map((city, i) => {
    const entry = { city, index: i };
    const catMap = new Map(grouped.find(d => d[0] === city)[1]);

    categories.forEach(cat => {
      entry[cat] = catMap.get(cat) ?? 0;
    });

    return entry;
  });

  // --- SORT CATEGORIES BY TOTAL ORDER VOLUME ---
  const categoryTotals = categories.map(cat => ({
    cat,
    total: d3.sum(rows, d => d[cat])
  }));

  categoryTotals.sort((a, b) => b.total - a.total);

  const sortedCategories = categoryTotals.map(d => d.cat);

  // --- STACK GENERATOR ---
  const stack = d3.stack()
    .keys(sortedCategories)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(rows);

  // --- CONTAINER ---
  const container = d3.create("div")
    .style("position", "relative")
    .style("width", width + "px")
    .style("overflow", "hidden");

  // --- TOOLTIP ---
  const tooltip = container.append("div")
    .style("position", "absolute")
    .style("padding", "14px 18px")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("pointer-events", "none")
    .style("font-size", "15px")
    .style("width", "22vw")
    .style("max-width", "320px")
    .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
    .style("opacity", 0);

  // --- SVG ---
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("font", "10px sans-serif");

  // --- SCALES ---
  const x = d3.scaleLinear()
    .domain([0, cities.length])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d3.sum(sortedCategories, c => d[c]))]).nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(sortedCategories)
    .range(d3.schemeTableau10);

  // --- LEGEND ---
  const legend = container.append("div")
    .style("display", "flex")
    .style("flex-wrap", "wrap")
    .style("gap", "10px")
    .style("margin", "10px 0 0 10px")
    .style("font-size", "12px");

  sortedCategories.forEach(cat => {
    const item = legend.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px");

    item.append("div")
      .style("width", "14px")
      .style("height", "14px")
      .style("background", color(cat))
      .style("border", "1px solid #999")
      .style("border-radius", "2px");

    item.append("span").text(cat);
  });

  // --- AXES ---
  const xAxisG = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .ticks(cities.length)
        .tickFormat(i => cities[i] ?? "")
    )
    .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

  const yAxisG = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("text")
    .attr("class", "axis-title axis-title-x")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .text("City");

  svg.append("text")
    .attr("class", "axis-title axis-title-y")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .text("Number of Restaurants");


  // --- CLIP PATH ---
  svg.append("defs").append("clipPath")
    .attr("id", "clip-bars")
    .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", width - margin.left - margin.right)
      .attr("height", height - margin.top - margin.bottom);

  // --- BAR LAYER ---
  const barLayer = svg.append("g")
    .attr("clip-path", "url(#clip-bars)");

  // --- DRAW STACKED BARS ---
  const groups = barLayer.selectAll("g.layer")
    .data(series)
    .join("g")
      .attr("class", "layer")
      .attr("fill", d => color(d.key));

  const rects = groups.selectAll("rect")
    .data(d => d)
    .join("rect")
      .attr("x", d => x(d.data.index))
      .attr("y", d => y(d[1]))
      .attr("width", (x(1) - x(0)) * 0.9)
      .attr("height", d => y(d[0]) - y(d[1]))
      .on("pointerenter", function(event, d) {
        const hoveredCategory = this.parentNode.__data__.key;
        const city = d.data.city;
        const value = d.data[hoveredCategory];

        groups.attr("opacity", g => (g.key === hoveredCategory ? 1 : 0.15));

        d3.select(this).attr("opacity", 1);

        tooltip
          .style("opacity", 1)
          .html(`
            <strong>City:</strong> ${city}<br>
            <strong>Category:</strong> ${hoveredCategory}<br>
            <strong>Orders:</strong> ${value}
          `);
      })
      .on("pointermove", function(event) {
        const [xm, ym] = d3.pointer(event, container.node());
        tooltip
          .style("left", xm + 12 + "px")
          .style("top", ym - 28 + "px");
      })
      .on("pointerleave", function() {
        groups.attr("opacity", 1);
        tooltip.style("opacity", 0);
      });

  // --- ZOOM + PAN ---
  const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on("zoom", event => {
      const zx = event.transform.rescaleX(x);
      const zy = event.transform.rescaleY(y);

      rects
        .attr("x", d => zx(d.data.index))
        .attr("width", (zx(1) - zx(0)) * 0.9)
        .attr("y", d => zy(d[1]))
        .attr("height", d => zy(d[0]) - zy(d[1]));

      xAxisG.call(
        d3.axisBottom(zx)
          .ticks(cities.length)
          .tickFormat(i => cities[Math.round(i)] ?? "")
      );

      yAxisG.call(d3.axisLeft(zy));
    });

  svg.call(zoom);

  // ⭐ Append to HTML
  document.querySelector(selector).appendChild(container.node());
  }