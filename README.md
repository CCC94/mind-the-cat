# Mind the Cat 🐱

A web application for tracking chores in shared living spaces. Perfect for roommates, families, or any group of people who need to coordinate household responsibilities.

## Features

### 🔐 Authentication
- **Google Sign-In**: Secure authentication using Firebase Authentication
- **Session Management**: Automatic login state restoration
- **User Profiles**: Display user information and manage sessions

### 👥 Group Management
- **Create Groups**: Set up shared spaces with unique group IDs
- **Join Groups**: Enter existing group IDs to join
- **Member Management**: Invite new members with admin privileges
- **Role-Based Access**: Admins can manage members and delete chores

### 🧹 Chore Tracking
- **Create Chores**: Add new household tasks to track
- **Mark as Done**: Record when chores are completed with timestamps
- **Track History**: See who completed each chore and when
- **Delete Chores**: Admins can remove completed or unnecessary chores

### 🎨 User Interface
- **Responsive Design**: Works on desktop and mobile devices
- **Three-View Navigation**: Login → Groups → Chores
- **Real-Time Updates**: Changes reflect immediately across all users
- **Intuitive Design**: Clean, modern interface with warm color scheme

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Firebase (Firestore Database, Authentication)
- **Deployment**: Static web hosting (Firebase Hosting compatible)

## Project Structure

```
mind-the-cat/
├── index.html          # Main HTML structure and views
├── style.css           # Application styling and layout
├── script.js           # Main UI logic and event handlers
├── auth.js             # Authentication and user management
├── group.js            # Group operations and permissions
├── chores.js           # Chore management and database operations
├── package.json        # Dependencies (Firebase)
└── README.md           # This file
```

## Setup Instructions

### Prerequisites
- Node.js (for package management)
- Firebase project with Authentication and Firestore enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mind-the-cat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Google Authentication
   - Create a Firestore database
   - Update the Firebase configuration in `auth.js` with your project details

4. **Run the application**
   - Serve the files using any static file server
   - For development: `python -m http.server 8000` or `npx serve .`
   - For production: Deploy to Firebase Hosting or any static hosting service

## Database Schema

### Groups Collection
```javascript
groups/{groupId} = {
  name: string,
  createdAt: timestamp,
  admins: { [userId]: boolean },
  members: {
    [userId]: {
      displayName: string,
      isAdmin: boolean
    }
  }
}
```

### Chores Subcollection
```javascript
groups/{groupId}/chores/{choreId} = {
  name: string,
  lastDone: timestamp | null,
  doneBy: {
    uid: string,
    displayName: string
  } | null
}
```

## Security Rules

The application uses Firebase Security Rules to ensure data protection:

- Users can only access groups they are members of
- Only admins can invite new members or delete chores
- All users can create and mark chores as done
- Authentication is required for all operations

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For questions or issues, please open an issue on the GitHub repository or contact the development team.

---

**Made with ❤️ for better shared living**
