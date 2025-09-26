const { URL } = require("url");

// --------------------------
// Step 1: Extract name from LinkedIn URL
// --------------------------
function parseNameFromUrl(linkedinUrl) {
  const url = new URL(linkedinUrl);
  let slug = url.pathname.split("/in/")[1].replace(/\//g, ""); // "severin-hacker-a5581517"

  // Remove trailing IDs like "a5581517"
  const parts = slug.split("-");
  const cleanParts = parts.filter(p => !/\d/.test(p));

  // Capitalize
  const fullName = cleanParts.map(
    p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  ).join(" ");

  return fullName;
}

// --------------------------
// Step 2: Generate email patterns
// --------------------------
function generatePatterns(first, last, domain) {
  const f = first.toLowerCase();
  const l = last.toLowerCase();
  const fi = f[0];
  const li = l[0];

  const patterns = [
    `${f}.${l}@${domain}`,
    `${f}${l}@${domain}`,
    `${fi}.${l}@${domain}`,
    `${f}.${li}@${domain}`,
    `${fi}${l}@${domain}`,
    `${f}@${domain}`,
    `${l}@${domain}`,
    `${f}_${l}@${domain}`,
    `${f}-${l}@${domain}`,
    `${fi}_${l}@${domain}`,
    `${l}${fi}@${domain}`
  ];
//console.log("patterns",patterns)
  // remove duplicates
  return [...new Set(patterns)];
}
// const resultt = generatePatterns("shaik", "yasar", "ovam.ai");
// console.log("Final Result:", resultt);

// --------------------------
// Step 3: Full pipeline
// --------------------------
function linkedinToEmails(url, company, domain) {
  const fullName = parseNameFromUrl(url);
  const nameParts = fullName.split(" ");
  if (nameParts.length < 2) {
    throw new Error("Could not parse first and last name properly.");
  }
  const first = nameParts[0];
  const last = nameParts[nameParts.length - 1];

  const emails = generatePatterns(first, last, domain);

  return {
    name: fullName,
    company,
    domain,
    emails
  };
}

// --------------------------
// Example usage
// --------------------------
const url = "https://www.linkedin.com/in/severin-hacker-a5581517/";
const company = "Duolingo";
const domain = "duolingo.com";

// const result = linkedinToEmails(url, company, domain);
// console.log("Final Result:", result);
module.exports = {linkedinToEmails,generatePatterns};