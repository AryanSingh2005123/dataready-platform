// The Parts 1-3 question bank. For each task we keep:
//   mysql — the canonical answer (what goes in the PDF), written in MySQL
//   sql   — an equivalent run live in SQLite (sql.js) to produce a real result
//           table. They differ only where MySQL and SQLite dialects diverge
//           (DATE_SUB vs DATE(..,'-30 day'), SUBSTRING_INDEX vs SUBSTR/INSTR);
//           MONTHNAME/DAYNAME are registered as SQLite functions so they match.
// "today" is fixed to 2025-04-16 per the assignment.

export const TODAY = '2025-04-16'

export const sections = [
  {
    id: 'part1',
    title: 'Part 1 — SQL & Data Familiarity',
    blurb: 'Core SELECTs over the customers table (and an orders join).',
    queries: [
      {
        id: 'p1-delhi',
        title: "All customers from the city 'Delhi'",
        mysql: "SELECT *\nFROM customers\nWHERE city = 'Delhi';",
        sql: "SELECT * FROM customers WHERE city = 'Delhi' ORDER BY customer_id;",
      },
      {
        id: 'p1-30days',
        title: 'Signups in the last 30 days (today = 16 Apr 2025)',
        mysql:
          "SELECT COUNT(*) AS signups_last_30_days\nFROM customers\nWHERE signup_date >= DATE_SUB('2025-04-16', INTERVAL 30 DAY)\n  AND signup_date <= '2025-04-16';",
        sql:
          "SELECT COUNT(*) AS signups_last_30_days\nFROM customers\nWHERE signup_date >= DATE('2025-04-16','-30 day')\n  AND signup_date <= '2025-04-16';",
      },
      {
        id: 'p1-cities',
        title: 'Unique cities where customers are based',
        mysql: 'SELECT DISTINCT city\nFROM customers\nORDER BY city;',
        sql: 'SELECT DISTINCT city FROM customers ORDER BY city;',
      },
      {
        id: 'p1-top3',
        title: 'Top 3 cities by number of signups',
        mysql:
          'SELECT city, COUNT(*) AS signups\nFROM customers\nGROUP BY city\nORDER BY signups DESC\nLIMIT 3;',
        sql: 'SELECT city, COUNT(*) AS signups FROM customers GROUP BY city ORDER BY signups DESC LIMIT 3;',
        chart: { x: 'city', y: 'signups' },
      },
      {
        id: 'p1-noorders',
        title: 'Customers who have never placed an order',
        note: 'Uses a LEFT JOIN to orders and keeps rows with no match (NULL).',
        mysql:
          'SELECT c.customer_id, c.full_name, c.email\nFROM customers c\nLEFT JOIN orders o ON c.customer_id = o.customer_id\nWHERE o.customer_id IS NULL;',
        sql:
          'SELECT c.customer_id, c.full_name, c.email\nFROM customers c\nLEFT JOIN orders o ON c.customer_id = o.customer_id\nWHERE o.customer_id IS NULL\nORDER BY c.customer_id;',
      },
    ],
  },
  {
    id: 'part2',
    title: 'Part 2 — Data Transformation & Enrichment',
    blurb: 'Derived columns, a day-of-week report, and a new vip_customers table.',
    queries: [
      {
        id: 'p2-gmail',
        title: "Flag whether the email domain is 'gmail.com' (Yes/No)",
        mysql:
          "SELECT customer_id, email,\n       CASE WHEN email LIKE '%@gmail.com' THEN 'Yes' ELSE 'No' END AS is_gmail\nFROM customers;",
        sql:
          "SELECT customer_id, email,\n       CASE WHEN email LIKE '%@gmail.com' THEN 'Yes' ELSE 'No' END AS is_gmail\nFROM customers ORDER BY customer_id LIMIT 25;",
      },
      {
        id: 'p2-firstname',
        title: "Extract the first name into 'first_name'",
        mysql:
          "SELECT customer_id, full_name,\n       SUBSTRING_INDEX(full_name, ' ', 1) AS first_name\nFROM customers;",
        sql:
          "SELECT customer_id, full_name,\n       SUBSTR(full_name, 1, INSTR(full_name || ' ', ' ') - 1) AS first_name\nFROM customers ORDER BY customer_id LIMIT 25;",
      },
      {
        id: 'p2-month',
        title: "Add 'signup_month' (month name)",
        mysql:
          'SELECT customer_id, signup_date,\n       MONTHNAME(signup_date) AS signup_month\nFROM customers;',
        sql:
          'SELECT customer_id, signup_date,\n       MONTHNAME(signup_date) AS signup_month\nFROM customers ORDER BY customer_id LIMIT 25;',
      },
      {
        id: 'p2-weekday',
        title: 'GMAIL signups per day of the week',
        mysql:
          "SELECT DAYNAME(signup_date) AS weekday, COUNT(*) AS gmail_signups\nFROM customers\nWHERE email LIKE '%@gmail.com'\nGROUP BY DAYNAME(signup_date)\nORDER BY FIELD(weekday,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday');",
        sql:
          "SELECT DAYNAME(signup_date) AS weekday, COUNT(*) AS gmail_signups\nFROM customers\nWHERE email LIKE '%@gmail.com'\nGROUP BY weekday\nORDER BY (strftime('%w', signup_date) + 6) % 7;",
        chart: { x: 'weekday', y: 'gmail_signups' },
      },
      {
        id: 'p2-vip',
        title: "Create the 'vip_customers' table",
        note: 'Delhi / Mumbai / Bangalore customers who signed up within 60 days of 16 Apr 2025. Running it creates the table; the live result previews who it contains.',
        mysql:
          "CREATE TABLE vip_customers AS\nSELECT *\nFROM customers\nWHERE city IN ('Delhi','Mumbai','Bangalore')\n  AND signup_date >= DATE_SUB('2025-04-16', INTERVAL 60 DAY);",
        sql:
          "SELECT *\nFROM customers\nWHERE city IN ('Delhi','Mumbai','Bangalore')\n  AND signup_date >= DATE('2025-04-16','-60 day')\nORDER BY signup_date DESC;",
      },
    ],
  },
  {
    id: 'part3',
    title: 'Part 3 — Analytics & Reporting',
    blurb: 'Trends and peaks the business team asked for.',
    queries: [
      {
        id: 'p3-monthly',
        title: 'Monthly signup count for the past 6 months',
        mysql:
          "SELECT DATE_FORMAT(signup_date, '%Y-%m') AS month, COUNT(*) AS signups\nFROM customers\nWHERE signup_date >= DATE_SUB('2025-04-16', INTERVAL 6 MONTH)\nGROUP BY month\nORDER BY month;",
        sql:
          "SELECT strftime('%Y-%m', signup_date) AS month, COUNT(*) AS signups\nFROM customers\nWHERE signup_date >= DATE('2025-04-16','-6 month')\nGROUP BY month\nORDER BY month;",
        chart: { x: 'month', y: 'signups' },
      },
      {
        id: 'p3-bigcities',
        title: 'Cities with more than 20 customers',
        mysql:
          'SELECT city, COUNT(*) AS customers\nFROM customers\nGROUP BY city\nHAVING COUNT(*) > 20\nORDER BY customers DESC;',
        sql:
          'SELECT city, COUNT(*) AS customers FROM customers GROUP BY city HAVING COUNT(*) > 20 ORDER BY customers DESC;',
      },
      {
        id: 'p3-peakdate',
        title: 'Date with the highest number of signups',
        mysql:
          'SELECT signup_date, COUNT(*) AS signups\nFROM customers\nGROUP BY signup_date\nORDER BY signups DESC\nLIMIT 1;',
        sql:
          'SELECT signup_date, COUNT(*) AS signups FROM customers GROUP BY signup_date ORDER BY signups DESC LIMIT 1;',
      },
      {
        id: 'p3-peakday',
        title: 'Day of week with the highest number of signups',
        note: 'Adds the weekday of each signup, then ranks by frequency.',
        mysql:
          'SELECT DAYNAME(signup_date) AS signup_day, COUNT(*) AS signups\nFROM customers\nGROUP BY DAYNAME(signup_date)\nORDER BY signups DESC\nLIMIT 1;',
        sql:
          'SELECT DAYNAME(signup_date) AS signup_day, COUNT(*) AS signups\nFROM customers\nGROUP BY signup_day\nORDER BY signups DESC\nLIMIT 1;',
      },
    ],
  },
]

// The Q1 written answer (data-review steps) — shown at the top of the workbench.
export const dataReviewAnswer = [
  'Profile the file first: row/column counts, data types, and a sample, checking the six expected columns are present and correctly named.',
  'Assess quality: missing/blank values, duplicate Customer IDs, malformed emails/phones, inconsistent city casing, and out-of-range or wrongly-formatted Signup Dates.',
  'Standardise before load: trim whitespace, normalise date format and phone country codes, dedupe on Customer ID, and confirm a primary key + encoding (UTF-8) so the import is clean and repeatable.',
]
