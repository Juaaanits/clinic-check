import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";

// My Firebase configuration from the Firebase project settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Get service instances and export them for use in other parts of your app
export const auth = getAuth(app);
export const db = getFirestore(app);

// Interface for the doctor data to be seeded
interface DoctorSeed {
    name: string;
    specialty: string;
    email: string; // Typically an email for contact, not a user login email
    phone: string;  
    address: string;
    status: 'Available' | 'Unavailable' | 'On Leave' | 'Retired' | 'Break';
}

/**
 * Seeds initial doctor data into Firestore if the 'doctors' collection is empty.
 * This prevents re-seeding every time the app loads.
 */
export const seedDoctors = async () => {
    // Array of doctor data to add
    const doctorsToSeed: DoctorSeed[] = [
        {
            name: "Dr. John Smith",
            specialty: "Cardiology",
            email: "dr.john.smith@example.com", // Changed to avoid confusion with user login email
            phone: "+11234567890",
            address: "123 Main St, Anytown",
            status: "Available"
        },
        {
            name: "Dr. Jane Doe",
            specialty: "Neurology",
            email: "dr.jane.doe@example.com", // Changed to avoid confusion with user login email
            phone: "+19876543210",
            address: "456 Oak Ave, Somewhere",
            status: "Available"
        },
        {
            name: "Dr. Robert Johnson",
            specialty: "Pediatrics",
            email: "dr.robert.j@example.com",
            phone: "+15551234567",
            address: "789 Pine Rd, Otherville",
            status: "Break"
        },
        {
            name: "Dr. Emily White",
            specialty: "Dermatology",
            email: "dr.emily.w@example.com",
            phone: "+14449876543",
            address: "101 Maple Ln, Anycity",
            status: "Unavailable"
        }
    ];

    try {
        const doctorsCollection = collection(db, 'doctors');
        // Check if the collection already contains any documents
        const existingDocs = await getDocs(doctorsCollection);

        if (existingDocs.empty) {
            console.log("No existing doctors found, seeding initial data...");
            // Add each doctor from the array to the 'doctors' collection
            for (const doctor of doctorsToSeed) {
                await addDoc(doctorsCollection, {
                    ...doctor,
                    // Use serverTimestamp() for accurate, server-generated timestamps
                    lastUpdated: serverTimestamp() 
                });
            }
            console.log("Initial doctor data seeded successfully.");
        } else {
            console.log("Doctors collection already has data, skipping seed.");
        } 
    } catch (error) {
        console.error("Error seeding doctors:", error);
        // You might want to throw the error or update a global error state here
    } 
};