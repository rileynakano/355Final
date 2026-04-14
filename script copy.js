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
    dayOfWeekChart(doordash_data, "#vis_2a");
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

  const width = 800;
  const height = 400;
  const margin = {top: 20, right: 30, bottom: 30, left: 50};

  // Parse time
  data.forEach(d => d.Time = new Date(d.Time));

  // Fold the columns
  const apps = ["Food delivery", "Uber Eats", "DoorDash", "Grubhub"];
  const folded = [];

  data.forEach(row => {
    apps.forEach(app => {
      folded.push({
        Time: row.Time,
        App: app,
        Value: +row[app]
      });
    });
  });

  // Group by App
  const groups = d3.group(folded, d => d.App);

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
    .attr("height", height)
    .style("font", "10px sans-serif");

  // Scales
  const x = d3.scaleUtc()
    .domain(d3.extent(folded, d => d.Time))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(folded, d => d.Value)]).nice()
    .range([height - margin.bottom, margin.top]);

  // Color scale
  const color = d3.scaleOrdinal()
    .domain(apps)
    .range(d3.schemeTableau10);

  // Axes
  const xAxisG = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width / 80).tickFormat(d3.utcFormat("%Y")));

  const yAxisG = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Clip path
  svg.append("defs").append("clipPath")
    .attr("id", "clip-lines")
    .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", width - margin.left - margin.right)
      .attr("height", height - margin.top - margin.bottom);

  // Line generator
  const line = d3.line()
    .x(d => x(d.Time))
    .y(d => y(d.Value));

  // Lines
  const lineLayer = svg.append("g")
    .attr("clip-path", "url(#clip-lines)");

  const paths = lineLayer.selectAll("path")
    .data(groups)
    .join("path")
      .attr("fill", "none")
      .attr("stroke", ([app]) => color(app))
      .attr("stroke-width", 1.5)
      .attr("d", ([app, values]) => line(values));

  // Precompute pixel positions
  const points = folded.map(d => ({
    x: x(d.Time),
    y: y(d.Value),
    d
  }));

  // Hover dot
  const hoverDot = svg.append("circle")
    .attr("r", 5)
    .attr("fill", "red")
    .style("display", "none");

  // Hover behavior
  svg
    .on("pointermove", event => {
      const [xm, ym] = d3.pointer(event);

      const nearest = d3.least(points, p => Math.hypot(p.x - xm, p.y - ym));
      if (!nearest) return;

      hoverDot
        .style("display", null)
        .attr("cx", nearest.x)
        .attr("cy", nearest.y);

      paths
        .attr("stroke", ([app]) =>
          app === nearest.d.App ? "red" : color(app)
        )
        .filter(([app]) => app === nearest.d.App)
        .raise();

      tooltip
        .style("opacity", 1)
        .style("left", nearest.x + 12 + "px")
        .style("top", nearest.y - 28 + "px")
        .html(`
          <strong>${nearest.d.App}</strong><br>
          Time: ${nearest.d.Time.toISOString().slice(0,10)}<br>
          Value: ${nearest.d.Value}
        `);
    })
    .on("pointerleave", () => {
      hoverDot.style("display", "none");
      tooltip.style("opacity", 0);
      paths.attr("stroke", ([app]) => color(app));
    });

  // Zoom + pan
  const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .translateExtent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
    .on("zoom", event => {
      const zx = event.transform.rescaleX(x);
      const zy = event.transform.rescaleY(y);

      // Update pixel positions
      points.forEach(p => {
        p.x = zx(p.d.Time);
        p.y = zy(p.d.Value);
      });

      // Update lines
      paths.attr("d", ([app, values]) =>
        d3.line()
          .x(d => zx(d.Time))
          .y(d => zy(d.Value))(values)
      );

      // Smart axis formatting
      const domain = zx.domain();
      const span = domain[1] - domain[0];
      const threeYears = 1000 * 60 * 60 * 24 * 365 * 4.5;

      const xAxis =
        span < threeYears
          ? d3.axisBottom(zx).ticks(8).tickFormat(d3.timeFormat("%b %Y"))
          : d3.axisBottom(zx).ticks(width / 80).tickFormat(d3.utcFormat("%Y"));

      xAxisG.call(xAxis);
      yAxisG.call(d3.axisLeft(zy));
    });

  svg.call(zoom);

  // ⭐ Append chart to HTML element
  document.querySelector(selector).appendChild(container.node());
}






function dayOfWeekChart(doordash_data, selector) {

  const data = doordash_data;

  const width = 500;
  const height = 300;
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

  // ⭐ New proportional sizing
  const width = 800;
  const height = Math.round(width * 0.4375); // ≈ 219px

  const margin = {top: 20, right: 30, bottom: 40, left: 50};

  // Extract hour
  const processed = data.map(d => {
    const date = new Date(d.created_at);
    return { hour: date.getHours() };
  });

  // Count orders per hour
  const counts = d3.rollups(
    processed,
    v => v.length,
    d => d.hour
  );

  const rows = counts.map(([hour, count]) => ({ hour: +hour, count }));
  rows.sort((a, b) => a.hour - b.hour);

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
  .attr("width", width)          // ⭐ NEW
  .attr("height", height)        // ⭐ NEW
  .attr("viewBox", [0, 0, width, height])
  .style("font", "10px sans-serif");


  // Scales
  const x = d3.scaleLinear()
    .domain([0, 23])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d.count)]).nice()
    .range([height - margin.bottom, margin.top]);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .ticks(24)
        .tickFormat(d => `${d}:00`)
    );

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Line generator
  const line = d3.line()
    .x(d => x(d.hour))
    .y(d => y(d.count));

  // Draw line
  svg.append("path")
    .datum(rows)
    .attr("fill", "none")
    .attr("stroke", "#1f77b4")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Precompute points
  const points = rows.map(d => ({
    x: x(d.hour),
    y: y(d.count),
    d
  }));

  // Hover dot
  const hoverDot = svg.append("circle")
    .attr("r", 5)
    .attr("fill", "red")
    .style("display", "none");

  // Hover behavior
  svg
    .on("pointermove", event => {
      const [xm, ym] = d3.pointer(event);

      const nearest = d3.least(points, p => Math.hypot(p.x - xm, p.y - ym));
      if (!nearest) return;

      hoverDot
        .style("display", null)
        .attr("cx", nearest.x)
        .attr("cy", nearest.y);

      tooltip
        .style("opacity", 1)
        .style("left", nearest.x + 12 + "px")
        .style("top", nearest.y - 28 + "px")
        .html(`
          <strong>Hour:</strong> ${nearest.d.hour}:00<br>
          <strong>Orders:</strong> ${nearest.d.count}
        `);
    })
    .on("pointerleave", () => {
      hoverDot.style("display", "none");
      tooltip.style("opacity", 0);
    });

  // Append to page
  document.querySelector(selector).appendChild(container.node());
}







function scatterSelection(cleaned_full_data, selector) {

  const data = cleaned_full_data;

  const width = 928;
  const height = 600;
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

  gx.append("text")
    .attr("x", width - marginRight)
    .attr("y", -4)
    .attr("fill", "#000")
    .attr("font-weight", "bold")
    .attr("text-anchor", "end")
    .text("Distance");

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

  const width = 500;
  const height = 300;
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


  const data = doordash_data;

  const width = 1200;
  const height = 400;
  const margin = {top: 20, right: 20, bottom: 60, left: 70};

  // Compute shifted subtotal
  const processed = data
    .map(d => ({
      store_primary_category: d.store_primary_category,
      subtotalShifted: Math.round((d.subtotal / 100) * 100) / 100
    }))
    .filter(d => d.subtotalShifted > 0);

  // Group by category
  const grouped = d3.rollups(
    processed,
    v => ({
      count: v.length,
      avgSubtotal: d3.mean(v, d => d.subtotalShifted)
    }),
    d => d.store_primary_category
  );

  // Convert to array
  const rows = grouped.map(([category, stats]) => ({
    category,
    count: stats.count,
    avgSubtotal: stats.avgSubtotal
  }));

  // Sort by count descending
  rows.sort((a, b) => b.count - a.count);

  const categories = rows.map(d => d.category);

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

  // Base linear scale for zooming
  const xLinear = d3.scaleLinear()
    .domain([0, categories.length])
    .range([margin.left, width - margin.right]);

  // Band scale (derived from linear)
  const x = d3.scaleBand()
    .domain(categories)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d.count)]).nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleSequential()
    .domain([0, d3.max(rows, d => d.avgSubtotal)])
    .interpolator(d3.interpolateBlues);

  // Axes
  const xAxisG = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .tickFormat(d => d.length > 12 ? d.slice(0, 12) + "…" : d)
    )
    .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end");

  const yAxisG = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // Clip path
  svg.append("defs").append("clipPath")
    .attr("id", "clip-bars5")
    .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", width - margin.left - margin.right)
      .attr("height", height - margin.top - margin.bottom);

  const barLayer = svg.append("g")
    .attr("clip-path", "url(#clip-bars5)");

  // Bars
  const bars = barLayer.selectAll("rect")
    .data(rows)
    .join("rect")
      .attr("x", d => x(d.category))
      .attr("y", d => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", d => y(0) - y(d.count))
      .attr("fill", d => color(d.avgSubtotal))
      .on("pointerenter", function(event, d) {
        d3.select(this).attr("fill", "#1f77b4");
        tooltip
          .style("opacity", 1)
          .html(`
            <strong>Category:</strong> ${d.category}<br>
            <strong>Times Ordered:</strong> ${d.count}<br>
            <strong>Avg Subtotal:</strong> $${d.avgSubtotal.toFixed(2)}
          `);
      })
      .on("pointermove", function(event) {
        const [xm, ym] = d3.pointer(event, container.node());
        tooltip
          .style("left", xm + 12 + "px")
          .style("top", ym - 28 + "px");
      })
      .on("pointerleave", function(event, d) {
        d3.select(this).attr("fill", color(d.avgSubtotal));
        tooltip.style("opacity", 0);
      });

  // ⭐ FIXED ZOOM + PAN
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[margin.left, 0], [width - margin.right, 0]])
    .extent([[margin.left, 0], [width - margin.right, 0]])
    .on("zoom", event => {
      const zx = event.transform.rescaleX(xLinear);

      // Update band scale range
      x.range([zx(0), zx(categories.length)]);

      // Update bars
      bars
        .attr("x", d => x(d.category))
        .attr("width", x.bandwidth());

      // Update x-axis
      xAxisG
        .call(
          d3.axisBottom(x)
            .tickFormat(d => d.length > 12 ? d.slice(0, 12) + "…" : d)
        )
        .selectAll("text")
          .attr("transform", "rotate(-35)")
          .style("text-anchor", "end");
    });

  svg.call(zoom);

  // ⭐ Append to HTML
  document.querySelector(selector).appendChild(container.node());

}






function stackedCityChart(cleaned_full_data, selector) {

  const width = 720;
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
