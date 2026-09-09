# Bug 1:
- Step 1: User create a Project and set Project Instruction
- Step 2: User create a new conversation outside the Project and chat with AI Assiatant
- Step 3: User move the created conversation into the created Project
=> The bugs was that: when user chat with the conversation after moved in the Project, the conversation did not follow the Project instruction
---
# Bug 2:
- Currently, AI Assistant just uses context, knowledge inside a specific conversation
- However, inside a project, each conversation should have ability to get context, knowledge from other conversations belong to same project
- So that, once implement this logic improvement, rememeber to check the appropriate rule:
    - If user move the conversation in current project outside the project or into another project, the conversation should follow the new rule/ instruction - let say, if conversation does not belong to any project, just use the context inside that conversation. if the conversation belongs to another project, should be able to use that project's conversations context/ knowledge, and follow that project's instruction.
---
# Bug 3:
- In Front-end, from Admin workspace, Change Suspend and Suspended to Deactivate and Deactivated
- Check those label in: Supervisor Management, Faculty Management pages 
---
# Bug 4:
- In Front-end, from Supervisor workspace, in Profile & Security component:
    - Hide Phone number section, move Academic allocation section there
---
