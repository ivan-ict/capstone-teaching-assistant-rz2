Web Application name: Capstone Teaching Assistant -> use this name for welcome text on Login page (do not change or shorten it)

Header: 
- include Streamlit system/ dark/ light mode and its default functions
- account logo (use first character of Firstname to generate the logo)
- when user click on the logo, will display:
    - next to the Logo is Fullname (Firstname + Lastname)
    - Profile (to view profile)
    - Logout (to sign out)
Left menu side bar (this section is for the screens for Admin and Supervisor only): 
- on the top should have logo: CTA (shorten for Capstone Teaching Assistant), hide/ expand side menu
- the other space for main display
A. Login Page:
- this page allows user to input username, password
after login successfully there are 2 different pages for 2 roles: Admin and Supervisor
- generally, after login, every pages should have header, and left menu side bar
- after login succesfully, users can logout
B. Admin page
- left menu side bar is on the left, includes:
    - Supervisors (for supervisor management)
    - Faculties (for faculty management)
1. when user clicks on Supervisor, on main display will show table view for supervisor management
- Split in to 2 view: Active Supervisor and Suspended Supervisor
- Table columns: Username, First name, Last name, Full name, Email, Phone, Teaching Year, Teaching Semester, Faculty, Created At, Updated At
- For each column support sort by acs and desc
- support functions for table: Filter by (Teaching Year, Teaching Semester, Faculty), Search by (Username, First name, Last name, Full name, Email, Phone)
- actions for supervisor management:
    - for active supervisor view: admin can select supervisor to suspend, show confirmation for suspending
    - for suspended supervisor view: 
        - admin can select supervisor to activate, show confirmation for activate
        - admin can select supervisor to change password, show new password input and confirmation
    - Add supervisor:
        - when admin click add supervisor will display a form to fill information:
            - Username (input), Password (input), First name (input), Last name (input), Email (input), Phone (input), Teaching Year (selection), Teaching Semester (selection), Faculty (Slection)
2. when user click on Faculty, on main display will show table view for faculty management
- Table columns: Faculty
- Actions for faculty management: 

C. Supervisor page:
- left menu side bar is on the left, includes:
    - Search Conversation icon (allow user click to show search popup, live search conversation by name)
    - New conversation (clickable menu item, to create new conversation)
    - Library (clickable menu item, to view uploaded files, images)
    - Label Projects and icon to create Project
        - Under Projects label, if user created Project will show as clickable items (icon folder + project name)
        - When user click on a Project, it will expand to show conversation items belong to that project
        - The conversation menu item display conversation name
    - Label Recent Conversations
        - below label recent conversations will show conversation items, display conversation name for them
1. when user click new conversation, on main display will show chat UI.
For chat UI:
- at the bottom show input for user to input their question or text, on the left message input area show add icon
    - when user click on add icon, show functions: 
        - Add images & files (allow user upload from computer)
        - Add from library (allow user choose uploaded file from library)
        - when user select "add images & files" option, open user local file manager/ finder to allow user choose images and files to upload
        - when user select "add from library" option, show library for user to choose uploaded images and files to attach to the chat
            - library will be display as popup, the uploaded files will be categorised by Project name label, any files or images do not belong to any project, will have Uncategorised label
            - Under each project label, display uploaded images and files belong to that project, with checkbox on the left to allow user choose which files and images they want, also provide select all files and images for each project except Uncategorised. It will be great if can display as table to show file/ image information: Name, Size, Uploaded at
    - after attach images and files successfully, show a scrollable list of attached images and files, also allow user to remove each of them before send question
    - after user send message to system, user message will display above the input message area, and be on top, align right with blue background. 
        - sent message of user, must display sent files and images belong to the message if it had.
        - display a copy icon if user need to copy text from message
    - message response from system will display align center with different background from message of user,
        - message response from system also display copy icon to allow user copy the response
        - message response from system also display files and images if it had (to show references where the answer use context to generate)
2. when user click on create project icon, it will show a form for user to fill information
- Project name (input), Instructions (text area, optional, placeholder: "Set context and customise how CTA responds in this project.") 
- once project created it will be showned uder Projects label
- next to project support two icon: new conversation (to create new conversation inside the project), and more options (to display other functions: project settings, delete project)
    - for "project settings", display popup: 
        - allow user change: project name, instructions.
        - allow user view attached files and images belong to the project (can resuse library UI for this). also allow user to delete files and images that they don't want to use for the project anymore
- For each Conversation item, next to it display more icon "...", when user click on more icon, show actions: rename, delete, move to project
    - when user hover on move to project, show:
        - new project: when user choose this option show New Project form (reuse create new project UI)
        - existed projects: when user choose this option, the conversation will be moved into the selected project. on the main display show list conversation belong to that project with the chat iput component (reuse from new conversation UI)
            - on top of conversation list, show that project name and icon settings: when user choose settings show project setting UI (reuse project settings UI)
            - on each conversation also show icon more actions: when user choose more actions, show: Rename, Delete, Move to project, Remove from project
- For the library menu item of left menu side bar:
    - when user click it, on main display shows list of uploaded files and images with categorised by project (label)
    - the uploaded files and images list can be shown as table: Name, Size, Uploaded at
        - allow user slect each file or user can select all file of project
        - after slect files and images, user can delete, download, start conversation
        - user can search by name
        - user can upload new files and images to existed project or uncategorised
---
projects, conversations, messages can be many so should support load more or show more
---
for the messages should display datetime label to seperate by date. for chat UI, always auto scroll down to the end of newest message.
on main display of chat UI (conversation) also show "more actions" icon on top, allow user to:
- view files in conversation, delete, move to project (reuse defined UI above)
---
for better user experince:
- on new conversation when no messages there can show some instructions for user how to use app
- for possible screens' components can show tooltips or guideline.
