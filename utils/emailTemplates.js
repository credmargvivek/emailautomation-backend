// utils/emailTemplates.js

/**
 * Templates for different campaigns
 * Each function takes { firstName, company, from } and returns { subject, body }
 */
const emailTemplates = {
    prReview1: ({ firstName, company, from }) => ({
      subject: `How ${company} could cut PR review time by 60%`,
      body: `Hi ${firstName},
  
  PR reviews are one of the biggest drains on engineering time — some teams see them eat up 40% of dev hours. At companies like Acme and Orion, Ovam helped reduce PR-to-merge cycles by up to 60%, without extra headcount.
  
  🚀 Faster launches → ship days earlier by cutting review cycles
  💸 Lower cost per feature → devs spend more time coding, less waiting
  🔒 Stronger reliability → automated bug detection + security scans before merge
  
  Would you be open to a 15-min walkthrough? I can show you how teams your size are saving weeks of engineering time each quarter.
  
  Best,  
  Mohan Krishna (Kris)  
  From: ${from}`
    }),
  
    prReview2: ({ firstName, company, from }) => ({
      subject: `How Acme saved 12+ hours/week in PR reviews`,
      body: `Hi ${firstName},
  
  At Acme, developers were losing over 12 hours every week stuck in review queues. After adopting Ovam, reviews moved in hours instead of days — freeing engineers to ship features faster.
  
  🚀 Faster cycles → PRs reviewed in hours, not days  
  💸 More bandwidth → devs focus on innovation, not waiting  
  🔒 Fewer bugs → early detection before merge  
  
  Would you like to see how ${company} could unlock a similar time savings? Happy to show you in a short demo.
  
  Best,  
  Mohan Krishna (Kris)  
  From: ${from}`
    }),
  
    jiraSlack: ({ firstName, company, from }) => ({
      subject: `End the Jira + Slack scavenger hunt`,
      body: `Hi ${firstName},
  
  Finding updates across Jira and Slack shouldn’t feel like a scavenger hunt. Ovam integrates directly so your team never loses context, and engineers don’t waste time searching for tickets or threads.
  
  🚀 Less context-switching → everything in one place  
  💸 Higher productivity → no wasted hours chasing info  
  🔒 Better accountability → every update is tracked  
  
  Would you be open to a quick walkthrough? I’ll show you how ${company} can simplify collaboration instantly.
  
  Best,  
  Mohan Krishna (Kris)  
  From: ${from}`
    })
  };
  
  module.exports = {emailTemplates};
  