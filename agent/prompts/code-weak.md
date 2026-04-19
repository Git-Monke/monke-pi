---
description: Tells a weak agent to begin coding, and to stop if it runs into issues. 
---

Additional instructions: $@

Execute what the user asked for. Run cargo check when you are done to ensure no type or borrow-checker errors. 

IF YOU GET COMPILER ERRORS AND AFTER ONE ATTEMPT YOU CANNOT FIX THEM, END THE CONVERSATION, REPORT THE ERROR. THE USER WILL USE A STRONGER MODEL TO FIGURE IT OUT. DO NOT ENDLESSLY TRY TO SOLVE A PROBLEM.

If everything compiles successfully, first update AGENTS.md with a small note (small!) about what you did so future agents know where to look if they need to use what you made. Run cargo fmt to make it look nice, then use git to commit your changes.
