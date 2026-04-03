      
async function fetchData() {
  const [cleaned_full_data,doordash_data,google_trends,time_series_worldwide]
  = await Promise.all ([d3.csv("./datasets/cleaned_full_data.csv"),
d3.csv("./datasets/doordash_data.csv"),d3.csv("./datasets/google_trends.csv")
,d3.csv("./datasets/time_series_Worldwide_20131231-1600_20260401-2321.csv")]);
  return {cleaned_full_data,doordash_data,google_trends,time_series_worldwide};
  }

  fetchData().then(async ({cleaned_full_data,doordash_data,google_trends,time_series_worldwide}) => {

//PART 1
const vis1_googlesearch =
  vl.markLine()
    .data(time_series_worldwide)
    .transform([
      {
        fold: ["Food delivery", "Uber Eats", "DoorDash", "Grubhub"],
        as: ["App", "Value"]
      }
    ])
    .encode(
      vl.x().fieldT("Time").title("Year").axis({format: "%Y"}),
      vl.y().fieldQ("Value").title("Times searched (millions)"),
      vl.color().fieldN("App").title("Searched Term")
    )
    .title("Amount of Times Food Delivery Apps Have Been Searched on Google")
    .width(800)
    .height(400)
    .toSpec();


//PART 2.1
const vis2a_daysoftheweek =
vl.markBar()
  .data(doordash_data)
  .transform([
    {
      calculate: "day(datum.created_at)",
      as: "weekdayNum"
    },
    {
      calculate: "['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][datum.weekdayNum]",
      as: "weekday"
    }
  ])
  .encode(
    vl.x()
      .fieldN("weekday")
      .title("Day of Week")
      .sort(["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]),
    vl.y()
      .aggregate("count")
      .title("Number of Orders"),
    vl.color()
      .aggregate("count")
      .title("Orders")
      .scale({scheme: "blues"}),

  )
  .title("Amount of Orders during the Day of the Week")
  .width(500)
  .height(300)
  .toSpec();


//PART 2.2
const vis2b_timeofday =
vl.markLine()
  .data(doordash_data)
  .transform([
    // Extract hour from ISO timestamp
    {
      calculate: "hours(datum.created_at)",
      as: "order_hour"
    }
  ])
  .encode(
    vl.x()
      .fieldQ("order_hour")
      .title("Hour of Day")
      .sort(("ascending"))
      .axis({
        values: [...Array(24).keys()],   // 0–23
        labelExpr: "datum.value + ':00'"
      }),

    vl.y()
      .aggregate("count")
      .title("Number of Orders"),
  )
  .title("Amount of Orders Over The Course of a Day")
  .width(600)
  .height(350)
  .toSpec();


//PART 3
const vis3_starrating =
vl.markBar()
.data(google_trends)
.encode(
  vl.x().fieldN("Apps").title("Delivery App"),
  vl.y().fieldQ("score").aggregate("average").title("Average Rating"),
)
  .width(500)
  .height(300)
  .toSpec();

//PART 4
const vis4_feeling =
vl.markBar()
  .data(google_trends)   // your dataset
  .transform([
    {
      fold: ["vader_pos", "vader_neg", "vader_neu"],
      as: ["sentiment", "score"]
    }
  ])
  .encode(
    vl.x().fieldN("Apps").title("Delivery App"),
    vl.y().fieldQ("score").title("Sentiment Score"),
    vl.color().fieldN("sentiment").title("Sentiment"),
    // vl.encode(vl.column().fieldN("sentiment")),
  )
  .width(400)
  .height(300)
  .toSpec();

//PART 5
const vis5_totalorders =
vl.markBar()
  .data(doordash_data)
  .transform([
    // Move decimal two places left (3000 → 30.00)
    { calculate: "datum.subtotal / 100", as: "subtotalShifted" },

    // Aggregate: count + average subtotal per category
    {
      aggregate: [
        { op: "count", field: "store_primary_category", as: "orderCount" },
        { op: "mean", field: "subtotalShifted", as: "avgSubtotal" }
      ],
      groupby: ["store_primary_category"]
    },

    // Filter out categories with fewer than 250 orders
    { filter: "datum.orderCount >= 250" }
  ])
  .encode(
    vl.x()
      .fieldN("store_primary_category")
      .title("Restaurant Genre")
      .sort("-y"),

    vl.y()
      .fieldQ("orderCount")
      .title("Total Orders"),

    // Color by average subtotal
    vl.color()
      .fieldQ("avgSubtotal")
      .title("Avg Subtotal ($)")
      .scale({scheme: "blues"}) 

      .legend({format: "$.2f"}),
  )
  .title("Total Orders of Each Genre of Food")
  .width(700)
  .height(420)
  .toSpec();

//PART 6
const vis6_canadiancities =
vl.markBar()
  .data(cleaned_full_data)
  .transform([
    // Count orders per city + category
    {
      aggregate: [
        { op: "count", as: "orderCount" }
      ],
      groupby: ["city", "category_1"]
    },

    // Rank categories within each city
    {
      window: [
        { op: "rank", as: "rank" }
      ],
      sort: [{ field: "orderCount", order: "descending" }],
      groupby: ["city"]
    },

    // Keep only top 3 categories per city
    { filter: "datum.rank <= 3" }
  ])
  .encode(
    // City on the x-axis
    vl.x()
      .fieldN("city")
      .title("City"),

    // Order count on the y-axis
    vl.y()
      .fieldQ("orderCount")
      .title("Number of Orders"),

    // Color by category
    vl.color()
      .fieldN("category_1")
      .title("Food Category"),
  )
  .width(720)
  .height(350)
  .toSpec();



  render("#vis1", vis1_googlesearch);
  render("#vis2a", vis2a_daysoftheweek);
  render("#vis2b", vis2b_timeofday);
  render("#vis3", vis3_starrating);
  render("#vis4", vis4_feeling);
  render("#vis5", vis5_totalorders);
  render("#vis6", vis6_canadiancities);
  });

  async function render(viewID, spec) {
  const result = await vegaEmbed(viewID, spec);
  result.view.run();
}