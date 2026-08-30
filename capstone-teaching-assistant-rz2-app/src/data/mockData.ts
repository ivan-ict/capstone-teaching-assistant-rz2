import { User, Faculty, Project, Conversation, AttachedFile } from '../types';

export const INITIAL_FACULTIES: Faculty[] = [
  {
    id: 'fac-1',
    name: 'Computer Science',
    code: 'CS',
    departmentHead: 'Prof. Alan Montgomery',
    activeSupervisorsCount: 8,
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2025-08-10T14:30:00.000Z',
  },
  {
    id: 'fac-2',
    name: 'Software Engineering',
    code: 'SE',
    departmentHead: 'Dr. Katherine Bell',
    activeSupervisorsCount: 6,
    createdAt: '2024-01-15T08:00:00.000Z',
    updatedAt: '2025-07-22T09:15:00.000Z',
  },
  {
    id: 'fac-3',
    name: 'AI & Data Science',
    code: 'AIDS',
    departmentHead: 'Prof. Marcus Vance',
    activeSupervisorsCount: 5,
    createdAt: '2024-02-01T10:00:00.000Z',
    updatedAt: '2025-08-01T11:00:00.000Z',
  },
  {
    id: 'fac-4',
    name: 'Information Systems',
    code: 'IS',
    departmentHead: 'Dr. Sandra Ortiz',
    activeSupervisorsCount: 4,
    createdAt: '2024-02-10T11:30:00.000Z',
    updatedAt: '2025-06-18T16:45:00.000Z',
  },
  {
    id: 'fac-5',
    name: 'Cyber Security',
    code: 'CYB',
    departmentHead: 'Dr. Gregory Thorne',
    activeSupervisorsCount: 3,
    createdAt: '2024-03-05T09:00:00.000Z',
    updatedAt: '2025-08-12T13:20:00.000Z',
  },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'admin',
    password: 'admin123',
    firstName: 'Arthur',
    lastName: 'Pendleton',
    fullName: 'Arthur Pendleton',
    email: 'admin.pendleton@swin.edu.au',
    phone: '+61 419 283 490',
    teachingYear: '2026',
    teachingSemester: 'Semester 1',
    faculty: 'Computer Science',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-10T08:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    avatarColor: 'bg-emerald-600',
  },
  {
    id: 'user-super-1',
    username: 'supervisor',
    password: 'super123',
    firstName: 'Evelyn',
    lastName: 'Reed',
    fullName: 'Evelyn Reed',
    email: 'evelyn.reed@swin.edu.au',
    phone: '+61 423 456 781',
    teachingYear: '2026',
    teachingSemester: 'Semester 2',
    faculty: 'Computer Science',
    role: 'supervisor',
    status: 'active',
    createdAt: '2024-02-14T09:30:00.000Z',
    updatedAt: '2026-08-22T14:15:00.000Z',
    avatarColor: 'bg-blue-600',
  },
  {
    id: 'user-super-2',
    username: 'mchen',
    password: 'password123',
    firstName: 'Michael',
    lastName: 'Chen',
    fullName: 'Michael Chen',
    email: 'm.chen@swin.edu.au',
    phone: '+61 434 567 892',
    teachingYear: '2026',
    teachingSemester: 'Semester 1',
    faculty: 'Software Engineering',
    role: 'supervisor',
    status: 'active',
    createdAt: '2024-03-01T11:00:00.000Z',
    updatedAt: '2026-08-15T16:00:00.000Z',
    avatarColor: 'bg-indigo-600',
  },
  {
    id: 'user-super-3',
    username: 'sarah.jenkins',
    password: 'password123',
    firstName: 'Sarah',
    lastName: 'Jenkins',
    fullName: 'Sarah Jenkins',
    email: 's.jenkins@swin.edu.au',
    phone: '+61 445 678 903',
    teachingYear: '2025',
    teachingSemester: 'Semester 2',
    faculty: 'AI & Data Science',
    role: 'supervisor',
    status: 'active',
    createdAt: '2024-04-12T13:45:00.000Z',
    updatedAt: '2026-07-30T10:20:00.000Z',
    avatarColor: 'bg-purple-600',
  },
  {
    id: 'user-super-4',
    username: 'dpatel',
    password: 'password123',
    firstName: 'Dev',
    lastName: 'Patel',
    fullName: 'Dev Patel',
    email: 'd.patel@swin.edu.au',
    phone: '+61 456 789 014',
    teachingYear: '2025',
    teachingSemester: 'Summer',
    faculty: 'Information Systems',
    role: 'supervisor',
    status: 'suspended',
    createdAt: '2024-01-20T10:15:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    avatarColor: 'bg-amber-600',
  },
  {
    id: 'user-super-5',
    username: 'lisa.wong',
    password: 'password123',
    firstName: 'Lisa',
    lastName: 'Wong',
    fullName: 'Lisa Wong',
    email: 'l.wong@swin.edu.au',
    phone: '+61 467 890 125',
    teachingYear: '2024',
    teachingSemester: 'Semester 1',
    faculty: 'Cyber Security',
    role: 'supervisor',
    status: 'suspended',
    createdAt: '2023-11-10T08:30:00.000Z',
    updatedAt: '2026-06-15T11:45:00.000Z',
    avatarColor: 'bg-rose-600',
  },
  {
    id: 'user-super-6',
    username: 'robert.taylor',
    password: 'password123',
    firstName: 'Robert',
    lastName: 'Taylor',
    fullName: 'Robert Taylor',
    email: 'r.taylor@swin.edu.au',
    phone: '+61 478 901 236',
    teachingYear: '2026',
    teachingSemester: 'Semester 2',
    faculty: 'Computer Science',
    role: 'supervisor',
    status: 'active',
    createdAt: '2024-05-18T14:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
    avatarColor: 'bg-teal-600',
  },
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'AI Health Diagnosis Capstone 2026',
    instructions: 'Focus on multimodal biomedical image analysis and ethical AI compliance in clinical environments. When answering, reference IEEE formatting standards and HIPAA compliance criteria.',
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-24T16:20:00.000Z',
    color: 'emerald',
  },
  {
    id: 'proj-2',
    name: 'Autonomous Rover IoT Navigation',
    instructions: 'Provide technical guidance on ROS 2 Humble integration, LiDAR point cloud clustering, and embedded ESP32 telemetry. Always verify battery power budget calculations.',
    createdAt: '2026-08-15T10:30:00.000Z',
    updatedAt: '2026-08-23T11:40:00.000Z',
    color: 'blue',
  },
  {
    id: 'proj-3',
    name: 'Smart Campus Energy Grid',
    instructions: 'Evaluate student milestone deliverables regarding solar PV forecasting algorithms and smart meter microgrid simulations.',
    createdAt: '2026-08-18T14:00:00.000Z',
    updatedAt: '2026-08-22T08:15:00.000Z',
    color: 'amber',
  },
];

export const INITIAL_FILES: AttachedFile[] = [
  {
    id: 'file-1',
    name: 'Capstone_Project_Charter_2026.pdf',
    size: 2450000,
    type: 'application/pdf',
    uploadedAt: '2026-08-12T10:00:00.000Z',
    projectIds: ['proj-1'],
    isImage: false,
  },
  {
    id: 'file-2',
    name: 'Biomedical_Dataset_Summary.csv',
    size: 512000,
    type: 'text/csv',
    uploadedAt: '2026-08-14T11:20:00.000Z',
    projectIds: ['proj-1'],
    isImage: false,
  },
  {
    id: 'file-3',
    name: 'Architecture_Diagram_V2.png',
    size: 1840000,
    type: 'image/png',
    uploadedAt: '2026-08-16T15:45:00.000Z',
    projectIds: ['proj-1'],
    isImage: true,
  },
  {
    id: 'file-4',
    name: 'ROS2_Sensor_Fusion_Spec.docx',
    size: 1280000,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    uploadedAt: '2026-08-16T09:30:00.000Z',
    projectIds: ['proj-2'],
    isImage: false,
  },
  {
    id: 'file-5',
    name: 'Rover_Chassis_Lidar_Mount.png',
    size: 3100000,
    type: 'image/png',
    uploadedAt: '2026-08-17T13:10:00.000Z',
    projectIds: ['proj-2'],
    isImage: true,
  },
  {
    id: 'file-6',
    name: 'General_Capstone_Grading_Rubric_v3.pdf',
    size: 890000,
    type: 'application/pdf',
    uploadedAt: '2026-08-01T08:00:00.000Z',
    projectIds: [], // Uncategorised
    isImage: false,
  },
  {
    id: 'file-7',
    name: 'Student_Peer_Evaluation_Template.xlsx',
    size: 450000,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: '2026-08-05T14:20:00.000Z',
    projectIds: [], // Uncategorised
    isImage: false,
  },
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Rubric Criteria for AI Health Milestone 1',
    projectId: 'proj-1',
    createdAt: '2026-08-24T09:00:00.000Z',
    updatedAt: '2026-08-24T09:15:00.000Z',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hi CTA, can you help me draft a rigorous grading rubric for Milestone 1 of the AI Health Diagnosis project? We need to assess model baseline accuracy, data preprocessing pipelines, and HIPAA compliance readiness.',
        timestamp: '2026-08-24T09:00:00.000Z',
        attachedFiles: [
          {
            id: 'file-1',
            name: 'Capstone_Project_Charter_2026.pdf',
            size: 2450000,
            type: 'application/pdf',
            uploadedAt: '2026-08-12T10:00:00.000Z',
            projectIds: ['proj-1'],
          }
        ],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: `Here is a tailored **Milestone 1 Assessment Rubric** for the **AI Health Diagnosis Capstone 2026** project, aligned with your project charter and IEEE standards:

### 📊 Milestone 1 Evaluation Matrix (Total: 100 pts)

| Component | Weight | Target Deliverable | Key Evaluation Criteria |
| :--- | :---: | :--- | :--- |
| **1. Data Preprocessing & Leakage Prevention** | 30% | Python/PyTorch pipeline + EDA report | Clean train/val/test splits, de-identification verification, handling class imbalance |
| **2. Baseline Model Architecture** | 30% | ResNet50 / ViT benchmark results | Well-structured ablation study, baseline F1-score & ROC-AUC > 0.85 |
| **3. HIPAA & Ethical AI Compliance** | 20% | Security & anonymization audit log | Patient metadata stripping, differential privacy considerations |
| **4. Technical Documentation & Code Quality** | 20% | Git repository & IEEE formatted report | Modular code, docstrings, unit tests (coverage > 80%), clear reproducibility steps |

### 💡 Suggested Feedback Prompts for Student Teams:
1. *"Verify that patient IDs from the same subject do not cross training and validation partitions to avoid data contamination."*
2. *"Include confidence calibration curves (e.g. Expected Calibration Error) alongside raw accuracy metrics."*`,
        timestamp: '2026-08-24T09:01:15.000Z',
        references: ['Capstone_Project_Charter_2026.pdf', 'Project Instructions (AI Health Diagnosis)'],
      },
    ],
  },
  {
    id: 'conv-2',
    title: 'LiDAR Sensor Lag Optimization Discussion',
    projectId: 'proj-2',
    createdAt: '2026-08-23T14:30:00.000Z',
    updatedAt: '2026-08-23T14:45:00.000Z',
    messages: [
      {
        id: 'msg-3',
        role: 'user',
        content: 'One student team is experiencing 180ms latency between the ESP32 LiDAR packet transmission and ROS2 navigation stack node. How should they isolate the bottleneck?',
        timestamp: '2026-08-23T14:30:00.000Z',
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: `To help the student team diagnose and eliminate the 180ms latency in their **ROS 2 + ESP32** telemetry pipeline, advise them to take the following systematic troubleshooting steps:

1. **Micro-ROS Transport Optimization**:
   - Check if serial baud rate is at least \`921600\` or switch to micro-ROS over Wi-Fi UDP.
   - Set QoS policy on the subscriber to **Best Effort** (\`rclcpp::SensorDataQoS()\`) rather than Reliable.

2. **Point Cloud Downsampling at Edge**:
   - Apply a voxel grid filter on the ESP32 before transmission rather than sending raw uncompressed packets.

3. **Node Execution Profiling**:
   - Use \`ros2 trace\` or \`tracetools\` to measure callback queue blockage in the single-threaded executor. Switch to \`MultiThreadedExecutor\` if necessary.`,
        timestamp: '2026-08-23T14:32:00.000Z',
        references: ['Project Instructions (Autonomous Rover IoT Navigation)'],
      },
    ],
  },
  {
    id: 'conv-3',
    title: 'Mid-term Presentation Schedule Announcement',
    projectId: null, // Recent Conversation (uncategorised)
    createdAt: '2026-08-25T05:00:00.000Z',
    updatedAt: '2026-08-25T05:10:00.000Z',
    messages: [
      {
        id: 'msg-5',
        role: 'user',
        content: 'Draft an email announcement to all Capstone 2026 student teams regarding their upcoming mid-term presentation defense next week.',
        timestamp: '2026-08-25T05:00:00.000Z',
      },
      {
        id: 'msg-6',
        role: 'assistant',
        content: `Here is a formal, clear announcement draft for your Capstone students:

---
**Subject:** [Action Required] Capstone Mid-Term Defense Presentations Schedule & Requirements

**Dear Capstone 2026 Project Teams,**

As we approach the mid-point of the academic term, this is a reminder that the **Mid-Term Project Defense & Live Demonstrations** will take place next week from **September 1 to September 3, 2026**.

### 🗓️ Presentation Format:
- **Total Duration:** 20 minutes per team (12 mins presentation + 8 mins Live Q&A).
- **Format:** In-person in Lab 402 / Virtual stream for industry mentors.
- **Deliverables Due:** Slide deck (PDF) and Progress Milestone Report due 24 hours prior to your scheduled slot.

### 📋 Key Evaluation Focus Areas:
1. **Current Progress vs. Initial Charter Timeline** (Gantt chart comparison).
2. **Live Technical Demonstration** of functional prototype/milestone.
3. **Identified Technical Risks & Mitigation Plan**.
4. **Individual Contribution Breakdown & Team Retrospective**.

Please ensure all team members are present and prepared. You can book your preferred defense slot via the Capstone Portal starting today at 5:00 PM.

Best regards,  
**Capstone Teaching Assistant & Faculty Committee**`,
        timestamp: '2026-08-25T05:01:20.000Z',
      },
    ],
  },
];
