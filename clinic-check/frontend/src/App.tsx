// clinic-check/frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { auth, db, seedDoctors } from './firebaseConfig';
import { type User, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import { collection, doc, onSnapshot, query, updateDoc, FieldValue, serverTimestamp} from 'firebase/firestore';

// Interface for a Doctor document as it appears in Firestore (including ID and Firestore Timestamp)
interface Doctor {
  id: string; // Firestore document ID
  name: string;
  specialty: string;
  status: 'Available' | 'Busy' | 'Break' | 'With Patient' | 'On Leave' | 'Retired'; // Expanded status types
  lastUpdated: FieldValue; // Can be a Timestamp object from Firestore or a pending FieldValue
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [message, setMessage] = useState(''); // For user feedback messages

  // --- Auth State Listener (Runs once on component mount to set up auth observer) ---
  useEffect(() => {
    // This subscribes to changes in the user's authentication state
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser); // Update React state with the current user
      setMessage(''); // Clear any previous messages on auth state change
    });

    // Cleanup function: unsubscribe from auth changes when the component unmounts
    return () => unsubscribeAuth();
  }, []); // Empty dependency array ensures this effect runs only once

  // --- Firestore Real-time Listener for Doctors & Initial Seeding Logic ---
  useEffect(() => {
    // If no user is logged in, clear doctors and stop further execution
    if (!user) {
      setDoctors([]); 
      return;
    }

    // When a user logs in, attempt to seed initial doctor data.
    // The seedDoctors function itself contains logic to prevent re-seeding if data exists.
    seedDoctors();

    // Set up real-time listener for the 'doctors' collection
    const doctorsCollectionRef = collection(db, 'doctors');
    const q = query(doctorsCollectionRef); // You can add orderBy, where clauses here if needed

    // Subscribe to real-time updates from Firestore
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const fetchedDoctors: Doctor[] = snapshot.docs.map(d => ({
        id: d.id, // Get the document ID
        // Cast data to Omit<Doctor, 'id'> as ID is handled separately
        ...d.data() as Omit<Doctor, 'id'> 
      }));
      setDoctors(fetchedDoctors); // Update the React state with the fetched doctors
    }, (error) => {
      // Error handling for Firestore listener
      console.error("Error fetching real-time doctor data:", error);
      setMessage(`Error: ${error.message}`);
    });

    // Cleanup function: unsubscribe from Firestore updates when the component unmounts or user changes
    return () => unsubscribeFirestore();
  }, [user]); // Re-run this effect whenever the 'user' object changes (e.g., on login/logout)

  // --- Authentication Handlers ---
  const handleSignUp = async () => {
    try {
      setMessage(''); // Clear previous messages
      await createUserWithEmailAndPassword(auth, email, password);
      setMessage('Signed up successfully! You are now logged in.');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error("Error signing up:", error.message);
      setMessage(`Sign Up Error: ${error.message}`);
    }
  };

  const handleSignIn = async () => {
    try {
      setMessage(''); // Clear previous messages
      await signInWithEmailAndPassword(auth, email, password);
      setMessage('Signed in successfully!');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error("Error signing in:", error.message);
      setMessage(`Sign In Error: ${error.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      setMessage(''); // Clear previous messages
      await signOut(auth);
      setMessage('Signed out.');
      // setUser(null) will be handled by the auth.onAuthStateChanged listener
    } catch (error: any) {
      console.error("Error signing out:", error.message);
      setMessage(`Sign Out Error: ${error.message}`);
    }
  };

  // --- Doctor Status Updater ---
  const updateStatus = async (docId: string, doctorName: string, newStatus: Doctor['status']) => {
    // Ensure user is logged in before allowing status updates
    if (!user) {
      setMessage('You must be logged in to update status.');
      return;
    }
    try {
      setMessage(''); // Clear previous messages
      const doctorDocRef = doc(db, 'doctors', docId); // Get a reference to the specific doctor document
      await updateDoc(doctorDocRef, {
        status: newStatus,
        lastUpdated: serverTimestamp(), // Update the timestamp to the server's time
      });
      setMessage(`Status updated for ${doctorName} to ${newStatus}.`);
    } catch (error: any) {
      console.error("Error updating status:", error.message);
      setMessage(`Update Error for ${doctorName}: ${error.message}`);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>ClinicCheck: Real-time Availability</h1>

      {/* Display messages to the user */}
      {message && <p style={styles.message}>{message}</p>}

      {/* Conditional rendering based on user login status */}
      {!user ? (
        // Login/Sign Up Section
        <div style={styles.authSection}>
          <h2>Login / Sign Up</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <div style={styles.buttonGroup}>
            <button onClick={handleSignIn} style={styles.button}>Sign In</button>
            <button onClick={handleSignUp} style={styles.button}>Sign Up</button>
          </div>
          <p style={styles.hint}>* If you sign up, an account will be created. Use it to sign in next time.</p>
        </div>
      ) : (
        // Logged-in Section (Doctor Statuses)
        <div style={styles.loggedInSection}>
          <p style={styles.loggedInUser}>Logged in as: {user.email}</p>
          <button onClick={handleSignOut} style={styles.logoutButton}>Sign Out</button>

          <h2 style={styles.subheader}>Doctor Statuses</h2>
          {doctors.length === 0 ? (
            <p>No doctor data available. Please ensure data is seeded or manually added in Firebase.</p>
          ) : (
            <div style={styles.doctorList}>
              {doctors.map((doctor) => (
                <div key={doctor.id} style={styles.doctorCard}>
                  <h3>{doctor.name} ({doctor.specialty})</h3>
                  <p>Current Status: <span style={getStatusStyle(doctor.status)}>{doctor.status}</span></p>
                  <p style={styles.lastUpdated}>
                    Last Updated: {
                      // Check if lastUpdated is a Firestore Timestamp object before calling toDate()
                      (doctor.lastUpdated && typeof (doctor.lastUpdated as any).toDate === 'function') ?
                      (doctor.lastUpdated as any).toDate().toLocaleString() :
                      'Updating...' // Display "Updating..." while waiting for server timestamp
                    }
                  </p>
                  <div style={styles.buttonGroup}>
                    {/* Map through all possible status options for update buttons */}
                    {['Available', 'Busy', 'Break', 'Unavailable', 'On Leave', 'Retired'].map((statusOption) => (
                      <button
                        key={statusOption}
                        onClick={() => updateStatus(doctor.id, doctor.name, statusOption as Doctor['status'])}
                        disabled={doctor.status === statusOption} // Disable button if it's the current status
                        style={{ ...styles.statusButton, ...(doctor.status === statusOption ? styles.statusButtonActive : {}) }}
                      >
                        {statusOption}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Minimal inline styles for quick visualization (can be moved to a CSS file)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
    maxWidth: '800px',
    margin: '20px auto',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  header: {
    textAlign: 'center',
    color: '#333',
  },
  subheader: {
    color: '#555',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
    marginBottom: '20px',
  },
  message: {
    backgroundColor: '#e6ffe6',
    border: '1px solid #00cc00',
    padding: '10px',
    borderRadius: '5px',
    color: '#006600',
    marginBottom: '15px',
    textAlign: 'center',
  },
  authSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center',
    padding: '20px',
    border: '1px dashed #eee',
    borderRadius: '5px',
  },
  input: {
    width: 'calc(100% - 20px)',
    padding: '10px',
    margin: '5px 0',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s',
  },
  buttonHover: { // Placeholder for hover effect, typically done with CSS :hover
    backgroundColor: '#0056b3',
  },
  logoutButton: {
    padding: '8px 15px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    float: 'right', 
  },
  loggedInSection: {
    paddingTop: '20px',
  },
  loggedInUser: {
    fontSize: '1.1em',
    fontWeight: 'bold',
    marginBottom: '15px',
    color: '#007bff',
  },
  doctorList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  doctorCard: {
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '15px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  lastUpdated: {
    fontSize: '0.8em',
    color: '#777',
    marginTop: '5px',
    marginBottom: '10px',
  },
  statusButton: {
    padding: '8px 12px',
    border: '1px solid #007bff',
    borderRadius: '4px',
    backgroundColor: 'white',
    color: '#007bff',
    cursor: 'pointer',
    transition: 'background-color 0.2s, color 0.2s',
    margin: '2px', 
  },
  statusButtonActive: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  hint: {
    fontSize: '0.8em',
    color: '#666',
    marginTop: '10px',
    textAlign: 'center',
  }
};

// Helper function to get distinct styles for different doctor statuses
const getStatusStyle = (status: Doctor['status']): React.CSSProperties => {
  switch (status) {
    case 'Available': return { color: 'green', fontWeight: 'bold' };
    case 'Busy': return { color: 'orange', fontWeight: 'bold' };
    case 'Break': return { color: 'purple', fontWeight: 'bold' };
    case 'With Patient': return { color: 'red', fontWeight: 'bold' };
    case 'On Leave': return { color: '#8B4513', fontWeight: 'bold' }; // SaddleBrown
    case 'Retired': return { color: '#696969', fontWeight: 'bold' }; // DimGray
    default: return {};
  }
};

export default App;