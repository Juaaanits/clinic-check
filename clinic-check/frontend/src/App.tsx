// clinic-check/frontend/src/App.tsx
import { useState, useEffect } from 'react';
import { auth, db, seedDoctors } from './firebaseConfig';
import { type User, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import { collection, doc, onSnapshot, query, updateDoc, FieldValue, serverTimestamp} from 'firebase/firestore';

// Interface for a Doctor document as it appears in Firestore (including ID and Firestore Timestamp)
interface Doctor {
  id: string; // Firestore document ID
  name: string;
  specialty: string;
  status: 'Available' | 'Busy' | 'Break' | 'With Patient' | 'Unavailable' | 'On Leave' | 'Retired'; // Expanded status types
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
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setMessage('');
    });
    return () => unsubscribeAuth();
  }, []);

  // --- Firestore Real-time Listener for Doctors & Initial Seeding Logic ---
  useEffect(() => {
    if (!user) {
      setDoctors([]);
      return;
    }

    seedDoctors();

    const doctorsCollectionRef = collection(db, 'doctors');
    const q = query(doctorsCollectionRef);

    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const fetchedDoctors: Doctor[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data() as Omit<Doctor, 'id'>
      }));
      setDoctors(fetchedDoctors);
    }, (error) => {
      console.error("Error fetching real-time doctor data:", error);
      setMessage(`Error: ${error.message}`);
    });

    return () => unsubscribeFirestore();
  }, [user]);

  // --- Authentication Handlers ---
  const handleSignUp = async () => {
    try {
      setMessage('');
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
      setMessage('');
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
      setMessage('');
      await signOut(auth);
      setMessage('Signed out.');
    } catch (error: any) {
      console.error("Error signing out:", error.message);
      setMessage(`Sign Out Error: ${error.message}`);
    }
  };

  // --- Doctor Status Updater ---
  const updateStatus = async (docId: string, doctorName: string, newStatus: Doctor['status']) => {
    if (!user) {
      setMessage('You must be logged in to update status.');
      return;
    }
    try {
      setMessage('');
      const doctorDocRef = doc(db, 'doctors', docId);
      await updateDoc(doctorDocRef, {
        status: newStatus,
        lastUpdated: serverTimestamp(),
      });
      setMessage(`Status updated for ${doctorName} to ${newStatus}.`);
    } catch (error: any) {
      console.error("Error updating status:", error.message);
      setMessage(`Update Error for ${doctorName}: ${error.message}`);
    }
  };

  return (
    <div className="container"> {/* Changed from style={styles.container} */}
      <h1 className="header">ClinicCheck: Real-time Availability</h1> {/* Changed from style={styles.header} */}

      {/* Display messages to the user */}
      {message && <p className="message">{message}</p>} {/* Changed from style={styles.message} */}

      {!user ? (
        // Login/Sign Up Section
        <div className="auth-section"> {/* Changed from style={styles.authSection} */}
          <h2>Login / Sign Up</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          /> {/* Changed from style={styles.input} */}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          <div className="button-group"> {/* Changed from style={styles.buttonGroup} */}
            <button onClick={handleSignIn} className="button">Sign In</button> {/* Changed from style={styles.button} */}
            <button onClick={handleSignUp} className="button">Sign Up</button> {/* Changed from style={styles.button} */}
          </div>
          <p className="hint">* If you sign up, an account will be created. Use it to sign in next time.</p> {/* Changed from style={styles.hint} */}
        </div>
      ) : (
        // Logged-in Section (Doctor Statuses)
        <div className="logged-in-section"> {/* Changed from style={styles.loggedInSection} */}
          <p className="logged-in-user">Logged in as: {user.email}</p> {/* Changed from style={styles.loggedInUser} */}
          <button onClick={handleSignOut} className="logout-button">Sign Out</button> {/* Changed from style={styles.logoutButton} */}

          <h2 className="subheader">Doctor Statuses</h2> {/* Changed from style={styles.subheader} */}
          {doctors.length === 0 ? (
            <p>No doctor data available. Please ensure data is seeded or manually added in Firebase.</p>
          ) : (
            <div className="doctor-list"> {/* Changed from style={styles.doctorList} */}
              {doctors.map((doctor) => (
                <div key={doctor.id} className="doctor-card"> {/* Changed from style={styles.doctorCard} */}
                  <h3>{doctor.name} ({doctor.specialty})</h3>
                  <p>Current Status: <span className={getStatusClassName(doctor.status)}>{doctor.status}</span></p> {/* Changed to className */}
                  <p className="last-updated"> {/* Changed from style={styles.lastUpdated} */}
                    Last Updated: {
                      (doctor.lastUpdated && typeof (doctor.lastUpdated as any).toDate === 'function') ?
                      (doctor.lastUpdated as any).toDate().toLocaleString() :
                      'Updating...'
                    }
                  </p>
                  <div className="button-group"> {/* Changed from style={styles.buttonGroup} */}
                    {
                      ['Available', 'Busy', 'Break', 'With Patient', 'Unavailable', 'On Leave', 'Retired'].map((statusOption) => (
                        <button
                          key={statusOption}
                          onClick={() => updateStatus(doctor.id, doctor.name, statusOption as Doctor['status'])}
                          // Conditional class names for active status and general button styling
                          className={`status-button ${doctor.status === statusOption ? 'status-button-active' : ''}`}
                        >
                          {statusOption}
                        </button>
                      ))
                    }
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

// Helper function to return the correct CSS class name for doctor status
const getStatusClassName = (status: Doctor['status']): string => {
  // Convert "With Patient" to "status-With-Patient" etc. for CSS class
  return `status-${status.replace(/\s+/g, '-')}`;
};

// Removed the 'styles' object from here as it's now in index.css
// Removed the 'getStatusStyle' function from here as it's now handled by CSS classes

export default App;