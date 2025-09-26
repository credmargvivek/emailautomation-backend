const  OpenAI =  require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function guessEmailPattern(name, company, domain) {
  const prompt = `
  A person named ${name} works at ${company} (${domain}).
  Guess the 6 most likely professional email addresses for this person.
  Only return emails,avoid spaces between characters nothing else.
  `;
  
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content.trim().split("\n");
}

// Example usage
// (async () => {
//   const guesses = await guessEmailPattern(
//     "vishalraina",
//     "ovam",
//     "ovam.ai"
//   );
//   //console.log("Guessed Emails:", guesses);
// })();
module.exports = {guessEmailPattern};