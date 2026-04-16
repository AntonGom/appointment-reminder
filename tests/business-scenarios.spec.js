const { test, expect } = require("@playwright/test");

function createBronzeUser({ businessName, customFormProfile }) {
  return {
    id: `user_${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    email: `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "")}@example.com`,
    user_metadata: {
      tier: "bronze",
      branding_profile: {
        brandingEnabled: true,
        businessName,
        templateStyle: "signature",
        headerLabel: "Appointment Reminder",
        headerColor: "#1d4ed8",
        accentColor: "#1d4ed8",
        secondaryColor: "#e8f1ff",
        heroGradientColor: "#60a5fa",
        heroGradientStyle: "solid",
        heroTextColor: "#ffffff",
        panelColor: "#f8fbff",
        detailsColor: "#f8fbff",
        calendarColor: "#f8fbff",
        bodyColor: "#ffffff",
        footerColor: "#0f172a",
        footerTextColor: "#ffffff",
        contactEmail: "owner@example.com"
      },
      custom_form_profile: {
        isEnabled: true,
        fields: customFormProfile.fields
      }
    },
    app_metadata: {}
  };
}

async function setSignedInUser(page, user) {
  await page.evaluate(async nextUser => {
    window.__testSignedInUser = nextUser;
    window.eval("currentSignedInUser = window.__testSignedInUser;");
    renderBronzeFeatures();
    updateDraftPreviewChrome();
    await syncCustomFormFromUser(window.__testSignedInUser);
    refreshFormState();
  }, user);
}

async function goToReviewStep(page) {
  await page.evaluate(() => {
    const reviewIndex = Array.from(document.querySelectorAll(".wizard-step"))
      .findIndex(step => step.dataset.field === "consent" || step.dataset.nav === "Review");

    if (reviewIndex >= 0) {
      setStep(reviewIndex, "forward");
    }
  });
}

const SCENARIOS = [
  {
    name: "barbershop booking keeps barber and cut type separate",
    businessName: "Sharp House Barbers",
    customFields: [
      {
        id: "preferred_barber",
        type: "select",
        title: "Preferred barber",
        label: "Preferred Barber",
        navLabel: "Barber",
        options: ["Alex", "Antonio", "Henry", "Jeffrey"],
        rememberClientAnswer: true
      },
      {
        id: "cut_type",
        type: "select",
        title: "Cut type",
        label: "Cut Type",
        navLabel: "Style",
        options: ["Fade", "Buzz", "Scissor Cut"]
      }
    ],
    prefill: {
      id: "client_barber",
      name: "Marcus Fade",
      email: "marcus@example.com",
      phone: "(305) 555-1001",
      address: "12 Barber Lane",
      profileCustomAnswers: {
        preferred_barber: {
          field_id: "preferred_barber",
          value: "Antonio",
          raw_value: "Antonio",
          display_value: "Antonio",
          type: "select"
        }
      }
    },
    fieldValues: {
      preferred_barber: "Antonio",
      cut_type: "Fade",
      date: "2026-05-10",
      time: "10:30",
      businessContact: "(305) 555-2000",
      notes: "Please come with clean dry hair."
    },
    expectedLines: ["Preferred Barber: Antonio", "Cut Type: Fade"]
  },
  {
    name: "auto shop booking keeps vehicle info intact",
    businessName: "Bay Auto Care",
    customFields: [
      {
        id: "vehicle_model",
        type: "text",
        title: "Vehicle model",
        label: "Vehicle Model",
        navLabel: "Vehicle",
        rememberClientAnswer: true
      },
      {
        id: "license_plate",
        type: "text",
        title: "License plate",
        label: "License Plate",
        navLabel: "Plate"
      }
    ],
    prefill: {
      id: "client_auto",
      name: "Jordan Driver",
      email: "jordan@example.com",
      phone: "(305) 555-1002",
      address: "88 Service Rd",
      profileCustomAnswers: {
        vehicle_model: {
          field_id: "vehicle_model",
          value: "Toyota Camry",
          raw_value: "Toyota Camry",
          display_value: "Toyota Camry",
          type: "text"
        }
      }
    },
    fieldValues: {
      vehicle_model: "Toyota Camry",
      license_plate: "RXT-204",
      date: "2026-05-11",
      time: "08:15",
      businessContact: "(305) 555-2001",
      notes: "Leave keys in the drop box if arriving early."
    },
    expectedLines: ["Vehicle Model: Toyota Camry", "License Plate: RXT-204"]
  },
  {
    name: "real estate meeting keeps property and meeting type separate",
    businessName: "Northline Realty",
    customFields: [
      {
        id: "property_address_custom",
        type: "text",
        title: "Property address",
        label: "Property Address",
        navLabel: "Property",
        rememberClientAnswer: true
      },
      {
        id: "meeting_type",
        type: "select",
        title: "Meeting type",
        label: "Meeting Type",
        navLabel: "Meeting",
        options: ["Listing Presentation", "Showing", "Closing Walkthrough"]
      }
    ],
    prefill: {
      id: "client_realestate",
      name: "Sofia Seller",
      email: "sofia@example.com",
      phone: "(305) 555-1003",
      address: "450 Ocean Drive",
      profileCustomAnswers: {
        property_address_custom: {
          field_id: "property_address_custom",
          value: "450 Ocean Drive",
          raw_value: "450 Ocean Drive",
          display_value: "450 Ocean Drive",
          type: "text"
        }
      }
    },
    fieldValues: {
      property_address_custom: "450 Ocean Drive",
      meeting_type: "Showing",
      date: "2026-05-12",
      time: "15:00",
      businessContact: "(305) 555-2002",
      notes: "Please have gate access ready for the buyers."
    },
    expectedLines: ["Property Address: 450 Ocean Drive", "Meeting Type: Showing"]
  },
  {
    name: "pet grooming booking keeps pet details connected",
    businessName: "Paws and Polish",
    customFields: [
      {
        id: "pet_name",
        type: "text",
        title: "Pet name",
        label: "Pet Name",
        navLabel: "Pet",
        rememberClientAnswer: true
      },
      {
        id: "pet_breed",
        type: "text",
        title: "Pet breed",
        label: "Pet Breed",
        navLabel: "Breed",
        rememberClientAnswer: true
      }
    ],
    prefill: {
      id: "client_groomer",
      name: "Nina Owner",
      email: "nina@example.com",
      phone: "(305) 555-1004",
      address: "16 Paw Path",
      profileCustomAnswers: {
        pet_name: {
          field_id: "pet_name",
          value: "Milo",
          raw_value: "Milo",
          display_value: "Milo",
          type: "text"
        },
        pet_breed: {
          field_id: "pet_breed",
          value: "Mini Goldendoodle",
          raw_value: "Mini Goldendoodle",
          display_value: "Mini Goldendoodle",
          type: "text"
        }
      }
    },
    fieldValues: {
      pet_name: "Milo",
      pet_breed: "Mini Goldendoodle",
      date: "2026-05-13",
      time: "13:45",
      businessContact: "(305) 555-2003",
      notes: "Use the hypoallergenic shampoo."
    },
    expectedLines: ["Pet Name: Milo", "Pet Breed: Mini Goldendoodle"]
  },
  {
    name: "plumbing booking keeps issue area and access notes separate",
    businessName: "Pipe Rescue",
    customFields: [
      {
        id: "issue_area",
        type: "select",
        title: "Issue area",
        label: "Issue Area",
        navLabel: "Issue",
        options: ["Kitchen Sink", "Bathroom Shower", "Water Heater"]
      },
      {
        id: "access_notes",
        type: "textarea",
        title: "Access notes",
        label: "Access Notes",
        navLabel: "Access"
      }
    ],
    prefill: {
      id: "client_plumber",
      name: "Carlos Homeowner",
      email: "carlos@example.com",
      phone: "(305) 555-1005",
      address: "22 Harbor Ave",
      profileCustomAnswers: {}
    },
    fieldValues: {
      issue_area: "Bathroom Shower",
      access_notes: "Side gate is unlocked. Please avoid the rose bushes.",
      date: "2026-05-14",
      time: "09:00",
      businessContact: "(305) 555-2004",
      notes: "Text when you are 15 minutes away."
    },
    expectedLines: ["Issue Area: Bathroom Shower", "Access Notes:", "Side gate is unlocked. Please avoid the rose bushes."]
  },
  {
    name: "hvac booking keeps unit and filter info connected",
    businessName: "Cool Current HVAC",
    customFields: [
      {
        id: "unit_type",
        type: "select",
        title: "Unit type",
        label: "Unit Type",
        navLabel: "Unit",
        options: ["Central AC", "Mini Split", "Heat Pump"]
      },
      {
        id: "filter_size",
        type: "text",
        title: "Filter size",
        label: "Filter Size",
        navLabel: "Filter"
      }
    ],
    prefill: {
      id: "client_hvac",
      name: "Emma Tenant",
      email: "emma@example.com",
      phone: "(305) 555-1006",
      address: "310 Breeze Blvd",
      profileCustomAnswers: {}
    },
    fieldValues: {
      unit_type: "Mini Split",
      filter_size: "20x20x1",
      date: "2026-05-15",
      time: "11:15",
      businessContact: "(305) 555-2005",
      notes: "Building concierge will provide access."
    },
    expectedLines: ["Unit Type: Mini Split", "Filter Size: 20x20x1"]
  },
  {
    name: "cleaning service booking keeps access and pets separate",
    businessName: "Spark Nest Cleaning",
    customFields: [
      {
        id: "entry_method",
        type: "text",
        title: "Entry method",
        label: "Entry Method",
        navLabel: "Entry"
      },
      {
        id: "pets_home",
        type: "select",
        title: "Pets at home",
        label: "Pets At Home",
        navLabel: "Pets",
        options: ["No", "Yes - Dog", "Yes - Cat"]
      }
    ],
    prefill: {
      id: "client_cleaning",
      name: "Olivia Resident",
      email: "olivia@example.com",
      phone: "(305) 555-1007",
      address: "78 Lavender Ct",
      profileCustomAnswers: {}
    },
    fieldValues: {
      entry_method: "Door code 2244",
      pets_home: "Yes - Cat",
      date: "2026-05-16",
      time: "14:00",
      businessContact: "(305) 555-2006",
      notes: "Please avoid the office desk area."
    },
    expectedLines: ["Entry Method: Door code 2244", "Pets At Home: Yes - Cat"]
  },
  {
    name: "med spa booking keeps provider and treatment separate",
    businessName: "Luma Med Spa",
    customFields: [
      {
        id: "provider_name",
        type: "select",
        title: "Provider",
        label: "Provider",
        navLabel: "Provider",
        options: ["Dr. Lee", "Nurse Camila", "Nurse Ava"]
      },
      {
        id: "treatment_name",
        type: "text",
        title: "Treatment",
        label: "Treatment",
        navLabel: "Treatment"
      }
    ],
    prefill: {
      id: "client_spa",
      name: "Rachel Glow",
      email: "rachel@example.com",
      phone: "(305) 555-1008",
      address: "501 Wellness Way",
      profileCustomAnswers: {}
    },
    fieldValues: {
      provider_name: "Nurse Camila",
      treatment_name: "Lip Filler Touch-Up",
      date: "2026-05-17",
      time: "12:30",
      businessContact: "(305) 555-2007",
      notes: "Arrive 10 minutes early for intake."
    },
    expectedLines: ["Provider: Nurse Camila", "Treatment: Lip Filler Touch-Up"]
  },
  {
    name: "photography booking keeps venue and shoot type connected",
    businessName: "Frame Story Studio",
    customFields: [
      {
        id: "shoot_type",
        type: "select",
        title: "Shoot type",
        label: "Shoot Type",
        navLabel: "Shoot",
        options: ["Headshots", "Engagement", "Family Session"]
      },
      {
        id: "venue_name",
        type: "text",
        title: "Venue name",
        label: "Venue Name",
        navLabel: "Venue"
      }
    ],
    prefill: {
      id: "client_photo",
      name: "Leah Couple",
      email: "leah@example.com",
      phone: "(305) 555-1009",
      address: "Sunset Park",
      profileCustomAnswers: {}
    },
    fieldValues: {
      shoot_type: "Engagement",
      venue_name: "Vizcaya Gardens",
      date: "2026-05-18",
      time: "18:00",
      businessContact: "(305) 555-2008",
      notes: "Bring a second outfit for golden hour."
    },
    expectedLines: ["Shoot Type: Engagement", "Venue Name: Vizcaya Gardens"]
  },
  {
    name: "mobile detailing booking keeps vehicle and package connected",
    businessName: "Gloss Mobile Detail",
    customFields: [
      {
        id: "vehicle_make",
        type: "text",
        title: "Vehicle make",
        label: "Vehicle Make",
        navLabel: "Vehicle"
      },
      {
        id: "detail_package",
        type: "select",
        title: "Detail package",
        label: "Detail Package",
        navLabel: "Package",
        options: ["Interior Only", "Exterior Only", "Full Detail"]
      }
    ],
    prefill: {
      id: "client_detail",
      name: "Andre Driver",
      email: "andre@example.com",
      phone: "(305) 555-1010",
      address: "901 Palm Ave",
      profileCustomAnswers: {}
    },
    fieldValues: {
      vehicle_make: "Range Rover",
      detail_package: "Full Detail",
      date: "2026-05-19",
      time: "07:45",
      businessContact: "(305) 555-2009",
      notes: "The car will be in the visitor parking deck."
    },
    expectedLines: ["Vehicle Make: Range Rover", "Detail Package: Full Detail"]
  },
  {
    name: "dog training booking keeps dog name and behavior goal connected",
    businessName: "Lead and Learn Training",
    customFields: [
      {
        id: "dog_name",
        type: "text",
        title: "Dog name",
        label: "Dog Name",
        navLabel: "Dog",
        rememberClientAnswer: true
      },
      {
        id: "behavior_goal",
        type: "textarea",
        title: "Behavior goal",
        label: "Behavior Goal",
        navLabel: "Goal"
      }
    ],
    prefill: {
      id: "client_trainer",
      name: "Maya Handler",
      email: "maya@example.com",
      phone: "(305) 555-1011",
      address: "63 Park Loop",
      profileCustomAnswers: {
        dog_name: {
          field_id: "dog_name",
          value: "Rocket",
          raw_value: "Rocket",
          display_value: "Rocket",
          type: "text"
        }
      }
    },
    fieldValues: {
      dog_name: "Rocket",
      behavior_goal: "Reduce leash pulling and improve recall in public places.",
      date: "2026-05-20",
      time: "17:15",
      businessContact: "(305) 555-2010",
      notes: "Bring Rocket's favorite treats."
    },
    expectedLines: ["Dog Name: Rocket", "Behavior Goal:", "Reduce leash pulling and improve recall in public places."]
  },
  {
    name: "tattoo consultation keeps artist and design size separate",
    businessName: "Blackline Atelier",
    customFields: [
      {
        id: "artist_name",
        type: "select",
        title: "Artist",
        label: "Artist",
        navLabel: "Artist",
        options: ["Niko", "Vale", "Sora"]
      },
      {
        id: "design_size",
        type: "text",
        title: "Design size",
        label: "Design Size",
        navLabel: "Size"
      }
    ],
    prefill: {
      id: "client_tattoo",
      name: "Ari Canvas",
      email: "ari@example.com",
      phone: "(305) 555-1012",
      address: "11 Ink Alley",
      profileCustomAnswers: {}
    },
    fieldValues: {
      artist_name: "Vale",
      design_size: "4 inch forearm piece",
      date: "2026-05-21",
      time: "16:30",
      businessContact: "(305) 555-2011",
      notes: "Bring the final reference images."
    },
    expectedLines: ["Artist: Vale", "Design Size: 4 inch forearm piece"]
  }
];

test.describe("Real-world business scenarios", () => {
  for (const scenario of SCENARIOS) {
    test(scenario.name, async ({ page }) => {
      await page.goto("/index.html");

      const user = createBronzeUser({
        businessName: scenario.businessName,
        customFormProfile: {
          fields: scenario.customFields
        }
      });

      await setSignedInUser(page, user);

      await page.evaluate(({ prefill, fieldValues }) => {
        applyReminderClientPrefillPayload(prefill);

        Object.entries(fieldValues).forEach(([fieldId, value]) => {
          const element = document.getElementById(fieldId);

          if (!element) {
            return;
          }

          element.value = String(value);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        });

        refreshFormState();
      }, {
        prefill: scenario.prefill,
        fieldValues: scenario.fieldValues
      });

      await goToReviewStep(page);

      await expect(page.locator("#bronze-preview-shell")).toBeVisible();
      await expect(page.locator("#preview-subject")).toContainText(scenario.prefill.name);

      const message = await page.evaluate(() => getCurrentReviewMessage());
      expect(message).toContain(`Hello ${scenario.prefill.name},`);
      expect(message).toContain("This is a friendly reminder about your upcoming appointment.");
      expect(message).toContain("If you need to reach us before your appointment");

      scenario.expectedLines.forEach(line => {
        expect(message).toContain(line);
      });
    });
  }
});
