import { ClipboardCheck, MessageSquare, FileText } from "lucide-react";

// ---- Mock content: Jet Turbine Fundamentals ----
// This is where your real question bank, videos, and PDFs will eventually live.
const MODULES = [
  { code: "JT", name: "Jet Turbine Fundamentals", status: "active", questions: 10, order: 1 },
  { code: "PROP", name: "Propulsion Systems", status: "active", questions: 8, order: 2 },
  { code: "AERO", name: "Aerodynamics & Principles of Flight", status: "active", questions: 8, order: 3 },
  { code: "NAV", name: "Navigation & Charts", status: "active", questions: 8, order: 4 },
  { code: "WX", name: "Aviation Weather", status: "active", questions: 8, order: 5 },
];

const CHAPTERS = [
  {
    id: "ch1",
    code: "JT.01",
    title: "Intake & Compressor Basics",
    body: [
      { heading: "Airflow through the inlet", text: "The inlet's job is to deliver air to the compressor at a stable pressure and a subsonic speed, whatever the aircraft is doing. In a subsonic inlet the duct is divergent: it slows the air down and, in doing so, raises its static pressure before the first compressor stage ever touches it. This recovery of pressure from ram effect is free thrust the engine does not have to work for." },
      { heading: "Axial compressor stages", text: "An axial compressor moves air parallel to the engine centreline, stage by stage. Each stage is a pair: a rotating rotor row that accelerates the air and adds energy, followed by a stationary stator row that diffuses that velocity back into static pressure and straightens the flow for the next rotor. Blades get progressively smaller toward the rear because the air is denser there and occupies less volume." },
      { heading: "Compressor stall and surge", text: "If the angle at which air meets the compressor blades becomes too great, the blades stall exactly as a wing does. A localised rotating stall can grow into a surge — a violent reversal of flow through the engine, often accompanied by a bang and rising EGT. Variable stator vanes and bleed valves exist to keep the blade angle of attack inside limits across the RPM range." },
    ],
    duration: "11:20",
    clip: "https://www.youtube.com/embed/CXSi4GXUojo",
    isPlaceholder: false,
    questions: [
      {
        id: "q1",
        stem: "In a jet engine's compressor, each successive stage generally has:",
        options: [
          "Larger blades and lower pressure than the previous stage",
          "Smaller blades and higher pressure than the previous stage",
          "The same blade size and pressure throughout",
          "Blades only on odd-numbered stages",
        ],
        answer: 1,
      },
      {
        id: "q2",
        stem: "An axial-flow compressor moves air:",
        options: [
          "Outward, perpendicular to the engine's centerline",
          "Parallel to the engine's centerline, stage by stage",
          "In a single reverse loop before combustion",
          "Only during engine start-up",
        ],
        answer: 1,
      },
      {
        id: "q3",
        stem: "Compressor stall is most likely to occur when:",
        options: [
          "Airflow into the compressor becomes smooth and steady",
          "Airflow is disrupted, causing blades to lose aerodynamic lift",
          "The engine is idling on the ground",
          "Fuel flow is reduced to zero",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch2",
    code: "JT.02",
    title: "Combustion Chamber Basics",
    body: [
      { heading: "Purpose of the combustor", text: "The combustion chamber adds fuel to the compressed air and burns it, raising the energy of the gas stream before it reaches the turbine. Pressure stays roughly constant through the burner; it is temperature and volume that rise sharply. This is the only place in the engine where energy is added." },
      { heading: "Primary and secondary airflow", text: "Only about a quarter of the air entering the combustor takes part in combustion. This primary air is slowed and swirled to hold a stable flame at roughly the correct fuel-to-air ratio. The remaining secondary air bypasses the flame, cools the liner, and is mixed back in downstream to bring the gas temperature down to something the turbine can survive." },
      { heading: "Ignition and flame stability", text: "Igniters are used only for starting and for relight; once burning, combustion is self-sustaining and the igniters are switched off. A flameout occurs when the flame is extinguished, typically by disrupted airflow, fuel starvation, or heavy precipitation, and requires a relight procedure." },
    ],
    duration: "14:50",
    clip: "https://www.youtube.com/embed/xycmedGUdB4",
    isPlaceholder: false,
    questions: [
      {
        id: "q4",
        stem: "The primary purpose of the combustion chamber is to:",
        options: [
          "Cool the compressed air before it reaches the turbine",
          "Add fuel and burn it to raise the energy of the airflow",
          "Compress air further before exhaust",
          "Reduce the velocity of exhaust gases",
        ],
        answer: 1,
      },
      {
        id: "q5",
        stem: "Igniters in the combustion chamber are typically used:",
        options: [
          "Continuously throughout the entire flight",
          "Only during engine start, since combustion becomes self-sustaining after",
          "Only during descent",
          "Only when the engine is shut down",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch3",
    code: "JT.03",
    title: "Turbine Section & Energy Extraction",
    body: [
      { heading: "Extracting energy from the gas", text: "The turbine converts the energy of the hot, high-pressure gas leaving the combustor into shaft power. That power drives the compressor and the accessory gearbox, and in a turboprop or turboshaft, the propeller or rotor as well. In a pure turbojet the turbine extracts only what the compressor needs, leaving the rest of the energy for the exhaust." },
      { heading: "Nozzle guide vanes and blades", text: "Each turbine stage begins with stationary nozzle guide vanes that accelerate the gas and turn it onto the rotating blades at the correct angle. The rotor blades then extract work as the gas expands across them, dropping in both pressure and temperature. Turbine blades are the most thermally stressed parts of the engine." },
      { heading: "Temperature limits", text: "Turbine inlet temperature is the limiting factor on how much thrust an engine can produce. Blades are protected by internal cooling passages, film cooling from secondary air, and thermal-barrier coatings. Exceeding temperature limits, even briefly, causes creep — permanent stretching of the blade — which is why EGT is monitored so closely during start and takeoff." },
    ],
    duration: "16:35",
    clip: "https://www.youtube.com/embed/6bJ8Q79CHio",
    isPlaceholder: false,
    questions: [
      {
        id: "q6",
        stem: "The turbine section extracts energy from the hot gas stream mainly to:",
        options: [
          "Increase exhaust temperature",
          "Drive the compressor and accessories",
          "Slow the aircraft during descent",
          "Cool the combustion chamber",
        ],
        answer: 1,
      },
      {
        id: "q7",
        stem: "Turbine blades are typically made from materials that prioritize:",
        options: [
          "Low cost over performance",
          "High-temperature strength and creep resistance",
          "Maximum flexibility at room temperature",
          "Low density above all other properties",
        ],
        answer: 1,
      },
      {
        id: "q8",
        stem: "Nozzle guide vanes ahead of the turbine exist mainly to:",
        options: [
          "Add fuel before the gas reaches the turbine",
          "Direct the gas stream onto the turbine blades at the correct angle",
          "Cool the compressor",
          "Generate electrical power",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch4",
    code: "JT.04",
    title: "Exhaust & Thrust Production",
    body: [
      { heading: "Turning energy into thrust", text: "The exhaust section accelerates the remaining gas to produce thrust. Thrust is the product of mass flow and the change in velocity the engine imparts to it, so an engine can make thrust either by moving a lot of air a little, or a little air a lot." },
      { heading: "Convergent nozzles and choking", text: "A subsonic exhaust nozzle is convergent: the duct narrows, the gas accelerates, and static pressure falls. When the flow reaches the speed of sound at the narrowest point the nozzle is choked, and no further reduction in downstream pressure can increase mass flow. High-performance engines use convergent-divergent nozzles to accelerate the flow beyond Mach 1." },
      { heading: "Bypass ratio and efficiency", text: "A high-bypass turbofan accelerates a large mass of air by a small amount, which is far more propulsively efficient at subsonic speeds and much quieter than a pure turbojet. This is why airliners use high-bypass engines while supersonic designs favour low-bypass or turbojet layouts." },
    ],
    duration: "13:05",
    clip: "https://www.youtube.com/embed/BxomJafd3Rs",
    isPlaceholder: false,
    questions: [
      {
        id: "q9",
        stem: "Thrust in a jet engine is produced mainly as a result of:",
        options: [
          "Newton's third law — accelerating air rearward",
          "The engine's weight pressing down on the airframe",
          "Friction between the exhaust and outside air",
          "The compressor spinning at high RPM",
        ],
        answer: 0,
      },
      {
        id: "q10",
        stem: "As altitude increases, air density decreases, which generally causes jet engine thrust to:",
        options: [
          "Increase, due to less aerodynamic drag on the engine",
          "Decrease, due to less air mass available to accelerate",
          "Stay exactly the same at all altitudes",
          "Increase only above the speed of sound",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch5",
    code: "PROP.01",
    title: "Propeller Aerodynamics & Pitch",
    duration: "12:40",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "The propeller as a rotating wing", text: "A propeller blade is an airfoil. It produces lift in the direction of flight, which we call thrust, and the resistance to its motion is drag on the blade. Blade angle of attack is the angle between the chord line and the relative wind, which is the vector sum of the aircraft's forward speed and the blade's rotational speed." },
      { heading: "Blade twist and geometric pitch", text: "The tip of a blade travels much further per revolution than the root, so it meets a much flatter relative wind. Blades are therefore twisted — high pitch at the root, low pitch at the tip — so that angle of attack stays roughly constant along the span. Geometric pitch is the distance the propeller would advance in one revolution in a solid medium; the shortfall against actual advance is slip." },
      { heading: "Fixed and constant-speed propellers", text: "A fixed-pitch propeller is efficient only at one combination of airspeed and RPM: a climb propeller has low pitch, a cruise propeller high pitch. A constant-speed propeller uses a governor to vary blade angle so engine RPM stays at the pilot's selected value, keeping the blades near their most efficient angle of attack across the whole flight envelope." },
    ],
    questions: [
      {
        id: "q11",
        stem: "A propeller blade produces thrust because it is:",
        options: [
          "A flat plate deflecting air rearward",
          "A rotating airfoil generating lift along the flight path",
          "A pump that compresses air before releasing it",
          "A fan relying purely on centrifugal force",
        ],
        answer: 1,
      },
      {
        id: "q12",
        stem: "Propeller blades are twisted from root to tip in order to:",
        options: [
          "Reduce manufacturing cost",
          "Keep angle of attack roughly constant along the blade",
          "Increase blade drag near the tip",
          "Allow the blade to flex under load",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch6",
    code: "PROP.02",
    title: "Reciprocating Engine Fundamentals",
    duration: "15:10",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "The four-stroke cycle", text: "Almost all light-aircraft piston engines run the Otto four-stroke cycle: intake, compression, power, exhaust. Two crankshaft revolutions complete one cycle in each cylinder. Ignition occurs before top dead centre so that peak cylinder pressure arrives just after the piston starts down." },
      { heading: "Dual ignition", text: "Aircraft engines carry two magnetos, two spark plugs per cylinder, and two independent ignition harnesses. This provides redundancy and, because the charge is lit from two points, a faster and more complete burn. A magneto is self-powered, so the engine keeps running with a total electrical failure — which is also why a hot magneto makes a propeller dangerous even with the master off." },
      { heading: "Mixture and detonation", text: "Air density falls with altitude, so a fixed fuel flow becomes progressively richer as you climb; leaning restores the correct fuel-to-air ratio. Detonation is the uncontrolled explosion of the remaining charge after normal ignition, caused by excessive heat, over-lean mixture, or low-grade fuel. Pre-ignition is different: the charge is lit early by a hot spot before the spark occurs." },
    ],
    questions: [
      {
        id: "q13",
        stem: "Aircraft piston engines use dual ignition primarily to provide:",
        options: [
          "Higher fuel flow at altitude",
          "Redundancy and a more complete, faster burn",
          "Automatic mixture control",
          "Lower oil temperature",
        ],
        answer: 1,
      },
      {
        id: "q14",
        stem: "Detonation is best described as:",
        options: [
          "Ignition of the charge before the spark occurs",
          "Uncontrolled explosion of the charge after normal ignition",
          "Failure of one magneto in flight",
          "Excessive propeller RPM",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch7",
    code: "PROP.03",
    title: "Turboprop & Turbofan Systems",
    duration: "14:20",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Turboprop layout", text: "A turboprop is a gas turbine geared down to drive a propeller, with most of the gas energy extracted by the turbine rather than left in the exhaust. In a free-turbine design the propeller is driven by its own turbine that is not mechanically connected to the gas generator, which allows the propeller to remain stationary while the core runs." },
      { heading: "Turbofan layout", text: "A turbofan places a large ducted fan ahead of the core. Bypass air goes around the core and produces most of the thrust at cruise. Bypass ratio is the mass of bypass air divided by the mass of core air; modern airliner engines run ratios of 9:1 or higher." },
      { heading: "Choosing between them", text: "Turboprops are most efficient at lower altitudes and speeds, typically below about 300 knots, which suits regional and short-field operations. Turbofans dominate above that, where propeller tip speeds would approach the speed of sound and efficiency would collapse." },
    ],
    questions: [
      {
        id: "q15",
        stem: "In a free-turbine turboprop, the propeller is driven by:",
        options: [
          "The same shaft as the gas generator",
          "A turbine not mechanically connected to the gas generator",
          "An electric motor at low power settings",
          "The accessory gearbox only",
        ],
        answer: 1,
      },
      {
        id: "q16",
        stem: "Bypass ratio is the ratio of:",
        options: [
          "Fuel flow to air flow",
          "Bypass air mass to core air mass",
          "Turbine speed to compressor speed",
          "Thrust to weight",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch8",
    code: "PROP.04",
    title: "Propulsion Performance & Efficiency",
    duration: "13:35",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Thrust versus power", text: "Thrust is force; power is force multiplied by velocity. A jet is rated in thrust and a piston or turboprop installation in shaft horsepower, which is why their performance charts look so different. Thrust horsepower is the useful power actually delivered by the propeller after propeller efficiency is applied." },
      { heading: "Specific fuel consumption", text: "SFC expresses fuel burned per unit of thrust or power per hour, and is the honest measure of engine efficiency. It improves with higher bypass ratio, higher turbine inlet temperature, and higher overall pressure ratio, which is why engine development pushes all three." },
      { heading: "Altitude and temperature effects", text: "Thrust and power both fall as density falls, so performance degrades with altitude, high temperature, and high humidity. Density altitude is the single number that captures this, and it is the figure that matters for takeoff distance and climb performance — not the altimeter reading." },
    ],
    questions: [
      {
        id: "q17",
        stem: "Specific fuel consumption measures:",
        options: [
          "Total fuel carried",
          "Fuel burned per unit of thrust or power per hour",
          "Fuel remaining at destination",
          "Fuel density at altitude",
        ],
        answer: 1,
      },
      {
        id: "q18",
        stem: "Engine performance decreases with all of the following except:",
        options: [
          "Increasing altitude",
          "Increasing temperature",
          "Increasing humidity",
          "Increasing air density",
        ],
        answer: 3,
      },
    ],
  },
  {
    id: "ch9",
    code: "AERO.01",
    title: "The Four Forces of Flight",
    duration: "11:45",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Lift, weight, thrust and drag", text: "Four forces act on an aircraft in flight. Lift acts perpendicular to the relative wind, weight acts vertically downward through the centre of gravity, thrust acts forward along the thrust line, and drag acts parallel to and opposing the relative wind." },
      { heading: "Equilibrium is not level flight", text: "In unaccelerated flight the opposing forces are in balance — but that is true in a steady climb, a steady descent, and a steady turn just as much as in level flight. Balanced forces mean no acceleration; they do not mean no vertical speed. This is one of the most commonly misread ideas in ground school." },
      { heading: "Load factor in the turn", text: "In a level turn, lift must both oppose weight and provide the horizontal component that turns the aircraft, so total lift must exceed weight. Load factor is total lift divided by weight: about 1.15 g at 30 degrees of bank, 1.41 g at 45, and 2.0 g at 60. Stall speed rises with the square root of load factor." },
    ],
    questions: [
      {
        id: "q19",
        stem: "In a steady, unaccelerated climb the four forces are:",
        options: [
          "Unbalanced, with thrust exceeding drag",
          "In balance, producing no acceleration",
          "Unbalanced, with lift exceeding weight",
          "Irrelevant, since the aircraft is climbing",
        ],
        answer: 1,
      },
      {
        id: "q20",
        stem: "In a level 60-degree banked turn, load factor is approximately:",
        options: [
          "1.15 g",
          "1.41 g",
          "2.0 g",
          "3.0 g",
        ],
        answer: 2,
      },
    ],
  },
  {
    id: "ch10",
    code: "AERO.02",
    title: "Lift Generation & Airfoils",
    duration: "13:20",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "How an airfoil produces lift", text: "An airfoil turns the air that flows over it. By deflecting the airflow downward, the wing experiences an equal and opposite upward reaction, and the associated pressure distribution leaves lower pressure above the wing than below it. Both descriptions — momentum change and pressure difference — describe the same physical event." },
      { heading: "Angle of attack", text: "Angle of attack is the angle between the chord line and the relative wind. It is not pitch attitude and it is not related to the horizon. Lift increases with angle of attack up to the critical angle, beyond which the airflow separates and lift falls away sharply." },
      { heading: "The lift equation", text: "Lift depends on air density, the square of the true airspeed, wing area, and the coefficient of lift, which is itself a function of angle of attack and airfoil shape. Because velocity is squared, doubling airspeed quadruples lift at a given angle of attack — which is why small airspeed changes matter so much in the flare." },
    ],
    questions: [
      {
        id: "q21",
        stem: "Angle of attack is the angle between the:",
        options: [
          "Chord line and the horizon",
          "Chord line and the relative wind",
          "Longitudinal axis and the horizon",
          "Wing and the fuselage",
        ],
        answer: 1,
      },
      {
        id: "q22",
        stem: "If airspeed doubles at a constant angle of attack, lift:",
        options: [
          "Doubles",
          "Halves",
          "Quadruples",
          "Stays the same",
        ],
        answer: 2,
      },
    ],
  },
  {
    id: "ch11",
    code: "AERO.03",
    title: "Stalls & Spins",
    duration: "14:05",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "What a stall actually is", text: "A stall occurs when the wing exceeds its critical angle of attack and the airflow separates from the upper surface. It has nothing directly to do with airspeed, weight, or attitude: a wing can be stalled at any airspeed and in any attitude. This is why angle of attack, not the airspeed indicator, is the true stall reference." },
      { heading: "Factors that change indicated stall speed", text: "Although the critical angle never changes, the indicated airspeed at which you reach it does. Stall speed rises with increased weight, with aft-to-forward centre of gravity movement, with load factor in manoeuvres, and with contamination such as frost or ice on the wing." },
      { heading: "Spins", text: "A spin is an aggravated stall with yaw, producing autorotation in which one wing is more deeply stalled than the other. Recovery follows the standard sequence: power idle, ailerons neutral, full opposite rudder, then brisk forward elevator to break the stall, and recover from the ensuing dive once rotation stops." },
    ],
    questions: [
      {
        id: "q23",
        stem: "A wing stalls when it exceeds its critical angle of attack:",
        options: [
          "Only at low airspeed",
          "Only in level flight",
          "At any airspeed and any attitude",
          "Only above manoeuvring speed",
        ],
        answer: 2,
      },
      {
        id: "q24",
        stem: "The first control input in a standard spin recovery after closing the throttle is to:",
        options: [
          "Apply full opposite aileron",
          "Neutralise ailerons and apply full opposite rudder",
          "Pull the elevator fully aft",
          "Extend the flaps",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch12",
    code: "AERO.04",
    title: "Stability & Control",
    duration: "12:15",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Static and dynamic stability", text: "Static stability describes the aircraft's initial tendency after a disturbance; dynamic stability describes what happens over time. An aircraft can be positively statically stable but dynamically unstable, in which case oscillations grow rather than damp out." },
      { heading: "The three axes", text: "Longitudinal stability about the lateral axis is controlled by the horizontal stabiliser and is the most important for pitch. Lateral stability about the longitudinal axis comes largely from wing dihedral and sweep. Directional stability about the vertical axis comes from the vertical fin." },
      { heading: "Centre of gravity effects", text: "A forward centre of gravity increases longitudinal stability but raises stall speed and control forces and reduces cruise performance. An aft centre of gravity reduces stability and can make stall recovery difficult or a spin unrecoverable, which is why the aft limit is treated so seriously in weight and balance." },
    ],
    questions: [
      {
        id: "q25",
        stem: "Static stability describes an aircraft's:",
        options: [
          "Behaviour over time after a disturbance",
          "Initial tendency after a disturbance",
          "Maximum load factor",
          "Stall speed at gross weight",
        ],
        answer: 1,
      },
      {
        id: "q26",
        stem: "An aft centre of gravity generally results in:",
        options: [
          "Increased stability and higher stall speed",
          "Reduced stability and possible spin recovery difficulty",
          "Higher control forces in pitch",
          "No effect on handling",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch13",
    code: "NAV.01",
    title: "Sectional Chart Symbology",
    duration: "12:50",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Scale and projection", text: "Sectional charts are drawn at 1:500,000 on a Lambert conformal conic projection, on which a straight line is close enough to a great circle for practical navigation. One inch represents about 6.86 nautical miles." },
      { heading: "Airspace depiction", text: "Class B airspace is shown by solid blue lines, Class C by solid magenta, Class D by dashed blue, and Class E surface areas by dashed magenta. The figures inside each segment give the ceiling above the floor, expressed in hundreds of feet MSL." },
      { heading: "Terrain and obstructions", text: "Maximum elevation figures in each quadrangle give the highest terrain or obstruction in that block, in thousands and hundreds of feet MSL. Obstructions over 1,000 feet AGL use a taller symbol, and any obstruction with a lighting dot is lit at night." },
    ],
    questions: [
      {
        id: "q27",
        stem: "Sectional charts are drawn at a scale of:",
        options: [
          "1:250,000",
          "1:500,000",
          "1:1,000,000",
          "1:2,000,000",
        ],
        answer: 1,
      },
      {
        id: "q28",
        stem: "A maximum elevation figure on a sectional gives the highest terrain or obstruction:",
        options: [
          "In the whole chart",
          "Within that quadrangle, in thousands and hundreds of feet MSL",
          "Along the nearest airway only",
          "Above ground level at the airport",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch14",
    code: "NAV.02",
    title: "VOR Navigation",
    duration: "15:30",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "How VOR works", text: "A VOR transmits a reference phase in all directions and a variable phase that rotates. The receiver compares the two and derives the magnetic bearing from the station — the radial the aircraft is on. Radials are always measured outbound from the station regardless of which way you are flying." },
      { heading: "Course deviation", text: "With the CDI centred and a TO indication, the selected course takes you to the station. Each dot of deviation represents about two degrees, so full-scale deflection is roughly ten degrees. Because the radials diverge, the same angular error means a much larger distance error far from the station." },
      { heading: "Reverse sensing and checks", text: "Reverse sensing occurs when the OBS setting and the direction of flight disagree — flying inbound with an outbound course set, for example. VOR accuracy must be checked periodically: a VOT gives 180 TO or 360 FROM within four degrees, and a dual-VOR cross-check must agree within four degrees." },
    ],
    questions: [
      {
        id: "q29",
        stem: "A VOR radial is always measured:",
        options: [
          "Inbound to the station",
          "Outbound from the station",
          "Relative to true north",
          "Relative to the aircraft heading",
        ],
        answer: 1,
      },
      {
        id: "q30",
        stem: "Full-scale CDI deflection on a VOR represents approximately:",
        options: [
          "2 degrees",
          "5 degrees",
          "10 degrees",
          "20 degrees",
        ],
        answer: 2,
      },
    ],
  },
  {
    id: "ch15",
    code: "NAV.03",
    title: "Dead Reckoning & Pilotage",
    duration: "13:10",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Pilotage and dead reckoning", text: "Pilotage is navigating by visual reference to landmarks. Dead reckoning computes position from a known starting point using heading, true airspeed, wind, and elapsed time. In practice the two are used together: dead reckoning predicts where the next landmark should appear, and pilotage confirms it." },
      { heading: "The wind triangle", text: "True airspeed and true course combine with wind direction and speed to give ground speed and the heading required. The angle between the heading flown and the course made good is the wind correction angle, applied into wind." },
      { heading: "Course terminology", text: "True course is measured from true north on the chart. Applying magnetic variation gives magnetic course; applying aircraft compass deviation gives compass course. Adding the wind correction angle turns a course into a heading — a course is where you want to go, a heading is where the nose points." },
    ],
    questions: [
      {
        id: "q31",
        stem: "The angle between the heading flown and the course made good is the:",
        options: [
          "Magnetic variation",
          "Compass deviation",
          "Wind correction angle",
          "Relative bearing",
        ],
        answer: 2,
      },
      {
        id: "q32",
        stem: "Applying magnetic variation to a true course produces:",
        options: [
          "Compass course",
          "Magnetic course",
          "True heading",
          "Ground track",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch16",
    code: "NAV.04",
    title: "GPS & RNAV Basics",
    duration: "14:40",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "GPS position fixing", text: "A GPS receiver measures the time of flight of signals from multiple satellites. Three satellites give a two-dimensional fix and four or more give altitude as well, since the receiver clock error must be solved alongside the three position unknowns." },
      { heading: "RAIM and augmentation", text: "Receiver autonomous integrity monitoring uses redundant satellites to detect a faulty signal, and needs at least five satellites to detect a fault and six to exclude it. WAAS improves both accuracy and integrity using ground reference stations, and is what makes LPV approaches with vertical guidance possible." },
      { heading: "RNAV in practice", text: "RNAV allows navigation on any desired path within the coverage of the navigation aids, rather than only along airway centrelines between ground stations. Waypoints may be fly-over, which must be crossed, or fly-by, where the turn is anticipated to join the next leg smoothly." },
    ],
    questions: [
      {
        id: "q33",
        stem: "The minimum number of GPS satellites required for a three-dimensional fix is:",
        options: [
          "Three",
          "Four",
          "Five",
          "Six",
        ],
        answer: 1,
      },
      {
        id: "q34",
        stem: "RAIM requires how many satellites to detect a faulty signal?",
        options: [
          "Four",
          "Five",
          "Six",
          "Seven",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch17",
    code: "WX.01",
    title: "Reading METARs & TAFs",
    duration: "12:25",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Reading a METAR", text: "A METAR is an actual observation, not a forecast. It runs in a fixed order: station identifier, day and time in UTC, wind, visibility, weather, sky condition, temperature and dew point, and altimeter setting. Times are always Zulu and the Z is explicit." },
      { heading: "Sky condition and ceiling", text: "Sky cover is reported in eighths: FEW is one to two, SCT three to four, BKN five to seven, and OVC eight. Ceiling is the lowest broken or overcast layer, so scattered cloud never constitutes a ceiling however low it sits." },
      { heading: "TAFs", text: "A TAF is a forecast for a five-statute-mile radius of the airport, normally valid for 24 or 30 hours. TEMPO indicates temporary conditions expected to last less than an hour at a time, while BECMG indicates a gradual permanent change to the new conditions." },
    ],
    questions: [
      {
        id: "q35",
        stem: "A ceiling is defined as the lowest layer reported as:",
        options: [
          "Few or scattered",
          "Scattered or broken",
          "Broken or overcast",
          "Overcast only",
        ],
        answer: 2,
      },
      {
        id: "q36",
        stem: "In a TAF, TEMPO indicates conditions expected to:",
        options: [
          "Become permanent",
          "Last less than an hour at a time",
          "Persist for the whole validity period",
          "Occur only after midnight",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch18",
    code: "WX.02",
    title: "Fronts & Air Masses",
    duration: "13:55",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Air masses", text: "An air mass takes the temperature and moisture properties of the surface it forms over. Continental air is dry and maritime air is moist; polar air is cold and tropical air is warm. A front is simply the boundary where two air masses of different properties meet." },
      { heading: "Cold and warm fronts", text: "A cold front is dense air undercutting warmer air. It moves quickly, has a steep slope, and produces narrow bands of intense weather with cumuliform cloud and rapid clearing. A warm front overrides colder air on a shallow slope, giving widespread stratiform cloud, extended periods of light precipitation, and poor visibility well ahead of the front." },
      { heading: "Occlusions and stationary fronts", text: "An occluded front forms when a faster cold front overtakes a warm front, lifting the warm air clear of the surface and combining the weather of both. A stationary front has little movement and can hold poor conditions over an area for days." },
    ],
    questions: [
      {
        id: "q37",
        stem: "Compared with a warm front, a cold front typically produces:",
        options: [
          "Widespread stratiform cloud and long periods of light rain",
          "Narrow bands of intense weather with rapid clearing",
          "No significant weather",
          "Persistent fog for several days",
        ],
        answer: 1,
      },
      {
        id: "q38",
        stem: "An occluded front forms when:",
        options: [
          "Two warm air masses meet",
          "A cold front overtakes a warm front",
          "A front stops moving",
          "An air mass loses all moisture",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch19",
    code: "WX.03",
    title: "Thunderstorms & Turbulence",
    duration: "15:05",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Thunderstorm requirements", text: "Three ingredients are needed: sufficient moisture, an unstable lapse rate, and a lifting action such as frontal movement, terrain, or surface heating. Remove any one and the storm cannot develop." },
      { heading: "The three stages", text: "In the cumulus stage updrafts dominate and the cloud builds. The mature stage begins when precipitation reaches the surface and both updrafts and downdrafts coexist — this is the most hazardous period. In the dissipating stage downdrafts dominate and the storm rains itself out." },
      { heading: "Hazards and avoidance", text: "Thunderstorms carry severe turbulence, hail that can be thrown well outside the cloud, lightning, icing, and microbursts capable of exceeding an aircraft's climb performance. Standard guidance is to remain at least 20 nautical miles from any storm reporting hail or heavy precipitation, and never to attempt to fly beneath one." },
    ],
    questions: [
      {
        id: "q39",
        stem: "The three ingredients required for a thunderstorm are moisture, a lifting action, and:",
        options: [
          "High pressure",
          "An unstable lapse rate",
          "Low humidity",
          "Strong surface wind",
        ],
        answer: 1,
      },
      {
        id: "q40",
        stem: "The most hazardous stage of a thunderstorm is the:",
        options: [
          "Cumulus stage",
          "Mature stage",
          "Dissipating stage",
          "Anvil stage",
        ],
        answer: 1,
      },
    ],
  },
  {
    id: "ch20",
    code: "WX.04",
    title: "Go/No-Go Weather Decisions",
    duration: "11:30",
    clip: null,
    isPlaceholder: true,
    body: [
      { heading: "Personal minimums", text: "Legal minimums are the floor, not the target. A personal minimums framework sets higher limits for ceiling, visibility, crosswind, and turbulence based on recency and experience, and is decided on the ground where judgement is unhurried." },
      { heading: "Structured decision making", text: "The PAVE checklist splits risk into Pilot, Aircraft, enVironment, and External pressures. The IMSAFE checklist covers pilot fitness: illness, medication, stress, alcohol, fatigue, and emotion. Both work because they force a deliberate pass over categories that are easy to skip when motivated to go." },
      { heading: "Recognising pressure", text: "Get-there-itis, the pressure to complete a flight as planned, is a recurring factor in weather accidents. A useful defence is deciding the diversion or cancellation criteria before departure, and treating a pre-briefed turn-back point as a commitment rather than an option." },
    ],
    questions: [
      {
        id: "q41",
        stem: "The PAVE checklist covers Pilot, Aircraft, enVironment and:",
        options: [
          "Endurance",
          "External pressures",
          "Equipment",
          "Elevation",
        ],
        answer: 1,
      },
      {
        id: "q42",
        stem: "Personal minimums should be set:",
        options: [
          "In the air as conditions develop",
          "On the ground, in advance of the flight",
          "By the aircraft owner",
          "By the destination airport",
        ],
        answer: 1,
      },
    ],
  },
];

const PDFS = [
  { id: "p1", title: "JT.02 — Combustion Chamber: Study Notes", pages: 10, size: "980 KB" },
  { id: "p2", title: "JT.03 — Turbine Section: Summary Sheet", pages: 6, size: "520 KB" },
  { id: "p3", title: "Jet Turbine Fundamentals — Key Terms Reference", pages: 4, size: "300 KB" },
];

const NAV = [
  { id: "chapters", label: "Chapters", icon: ClipboardCheck },
  { id: "discuss", label: "Discussion", icon: MessageSquare },
  { id: "pdf", label: "Library", icon: FileText },
];


const TRIVIA = [
  "The Boeing 747's wingspan (68.4 m) is longer than the Wright brothers' first powered flight (36.5 m).",
  "A jet engine can process enough air per second to fill a small house.",
  "Concorde could cross the Atlantic in under 3.5 hours — faster than the Earth's own rotation beneath it.",
  "At a typical 35,000 ft cruising altitude, the sky above starts to look noticeably darker.",
  "Some turbine blades spin at speeds exceeding 10,000 RPM.",
];

const ACCENT_COLORS = {
  blue: {
    label: "Sky Blue",
    swatch: "#6FA0F0",
    dark: { accent: "#6FA0F0", hover: "#8FB8F5", soft: "rgba(111,160,240,0.10)", onAccent: "#0E1830" },
    light: { accent: "#3D6FD1", hover: "#5A8AE0", soft: "rgba(61,111,209,0.08)", onAccent: "#FFFFFF" },
  },
  green: {
    label: "Runway Green",
    swatch: "#4CAF7D",
    dark: { accent: "#4CAF7D", hover: "#6BC494", soft: "rgba(76,175,125,0.12)", onAccent: "#06210F" },
    light: { accent: "#2F9D64", hover: "#4BB57D", soft: "rgba(47,157,100,0.10)", onAccent: "#FFFFFF" },
  },
  red: {
    label: "Beacon Red",
    swatch: "#E5484D",
    dark: { accent: "#E5484D", hover: "#ED6F73", soft: "rgba(229,72,77,0.12)", onAccent: "#2A0C0D" },
    light: { accent: "#D14F4F", hover: "#DB6B6B", soft: "rgba(209,79,79,0.10)", onAccent: "#FFFFFF" },
  },
  amber: {
    label: "Gauge Amber",
    swatch: "#E8A33D",
    dark: { accent: "#E8A33D", hover: "#EDB563", soft: "rgba(232,163,61,0.12)", onAccent: "#2A1B04" },
    light: { accent: "#C77F1D", hover: "#D89A44", soft: "rgba(199,127,29,0.10)", onAccent: "#FFFFFF" },
  },
  grey: {
    label: "Tarmac Grey",
    swatch: "#9BA8B8",
    dark: { accent: "#9BA8B8", hover: "#B3BEC9", soft: "rgba(155,168,184,0.12)", onAccent: "#101B26" },
    light: { accent: "#5C6B7D", hover: "#7A8AA0", soft: "rgba(92,107,125,0.10)", onAccent: "#FFFFFF" },
  },
};

// Chapter codes are "<MODULE>.<NN>", so a module owns every chapter whose
// code carries its prefix. Single source of truth for the partition.
function chaptersForModule(moduleCode) {
  return CHAPTERS.filter((ch) => String(ch.code).split(".")[0] === moduleCode);
}

export { MODULES, CHAPTERS, chaptersForModule, PDFS, NAV, TRIVIA, ACCENT_COLORS };
