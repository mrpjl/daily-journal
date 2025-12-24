const START_DATE = new Date('2025-05-01');
const API_URL = 'http://localhost:3000/api'; // Ensure this matches the server's base URL

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Application initialized. Loading heatmap...');
    
    // Add meta description for SEO
    const metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    metaDescription.content = 'Track your daily emotions and visualize them in a heatmap. Add notes and tags to reflect on your emotional journey.';
    document.head.appendChild(metaDescription);

    document.getElementById('date').valueAsDate = new Date();

    // Attach the addEntry function to the button
    document.getElementById('addEntryButton').addEventListener('click', addEntry);

    // Update character counter for notes
    const notesInput = document.getElementById('notes');
    const notesCounter = document.getElementById('notesCounter');
    notesInput.addEventListener('input', () => {
        notesCounter.textContent = `${notesInput.value.length}/1000 characters`;
    });

    await renderHeatMap();
    console.log('Heatmap loaded successfully.');
});

function getEmotionColor(score) {
    // if (score === null) return '#ebedf0'; // Neutral color for no data
    if (score === null) return '#2c2c2c'; // Default dark background for no data

    // Assign distinct colors for each value from -5 to 5
    const colorPalette = {
        // LIGHTER COLORS FOR EXTREMES
        // '-5': '#b71c1c', // Dark red
        // '-4': '#d32f2f', // Red
        // '-3': '#f44336', // Light red
        // '-2': '#ff7043', // Orange
        // '-1': '#f8bbd0', // Light pink
        //  '0': '#ebedf0', // Neutral gray
        //  '1': '#c8e6c9', // Light green
        //  '2': '#81c784', // Green
        //  '3': '#4caf50', // Dark green
        //  '4': '#388e3c', // Deeper green
        //  '5': '#1b5e20'  // Deepest green contrast

        // DARKER COLORS FOR EXTREMES
        '-5': '#8b0000', // Dark red
        '-4': '#a52a2a', // Brownish red
        '-3': '#cd5c5c', // Light coral
        '-2': '#d2691e', // Chocolate for -2
        '-1': '#f4a460', // Light orange
         '0': '#3a3a3a', // Neutral dark gray
         '1': '#556b2f', // Olive green
         '2': '#6b8e23', // Dark olive green
         '3': '#228b22', // Forest green
         '4': '#006400', // Dark green
         '5': '#013220'  // Deepest green
    };

    // return colorPalette[score] || '#ebedf0'; // Default to neutral if score is invalid
    return colorPalette[score] || '#2c2c2c'; // Default to dark background if score is invalid
}

function getEmotionState(score) {
    const emotionStates = {
        '-5': 'Very Angry',
        '-4': 'Angry',
        '-3': 'Frustrated',
        '-2': 'Upset',
        '-1': 'Sad',
         '0': 'Neutral',
         '1': 'Content',
         '2': 'Happy',
         '3': 'Very Happy',
         '4': 'Excited',
         '5': 'Ecstatic'
    };
    return emotionStates[score] || 'Unknown';
}

async function loadData() {
    console.log('Fetching scores for heatmap from the server...');
    try {
        const response = await fetch(`${API_URL}/emotions/heatmap`);
        if (!response.ok) {
            throw new Error('Failed to load heatmap data');
        }
        console.log('Scores for heatmap fetched successfully.');
        return await response.json();
    } catch (error) {
        console.error('Error loading heatmap data:', error);
        alert('Failed to load heatmap data. Make sure the server is running.');
        return {};
    }
}

async function saveData(date, score, notes, tags) {
    console.log(`Saving data for date: ${date}, score: ${score}, tags: ${tags}`);
    try {
        const response = await fetch(`${API_URL}/emotions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date, score, notes, tags })
        });

        if (!response.ok) {
            throw new Error('Failed to save data');
        }

        console.log('Data saved successfully.');
        return await response.json();
    } catch (error) {
        console.error('Error saving data:', error);
        alert('Failed to save emotion entry. Make sure the server is running.');
        throw error;
    }
}

async function addEntry() {
    const dateInput = document.getElementById('date').value;
    const formattedDate = ensureDateFormat(dateInput); // Ensure the date is in "YYYY-MM-DD"
    const emotionInput = parseInt(document.getElementById('emotion').value);
    const notesInput = document.getElementById('notes').value;

    // Collect selected tags
    const tags = Array.from(document.querySelectorAll('#tagsCheckboxes input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value)
        .join('-');

    console.log('Adding new entry...');
    if (!formattedDate || isNaN(emotionInput)) {
        console.warn('Validation failed: Missing date or invalid emotion score.');
        alert('Please fill in all fields');
        return;
    }

    if (emotionInput < -5 || emotionInput > 5) {
        console.warn('Validation failed: Emotion score out of range.');
        alert('Emotion score must be between -5 and 5');
        return;
    }

    if (!tags) {
        console.warn('Validation failed: No tags selected.');
        alert('Please select at least one tag');
        return;
    }

    try {
        await saveData(formattedDate, emotionInput, notesInput, tags);
        await renderHeatMap();
        console.log('New entry added successfully.');
        alert('Entry added successfully!');
    } catch (error) {
        // Error already handled in saveData
    }
}

function getMonthsBetween(startDate, endDate) {
    const months = [];
    const current = new Date(startDate);
    current.setDate(1);
    
    while (current <= endDate) {
        months.push({
            month: current.getMonth(),
            year: current.getFullYear(),
            label: current.toLocaleDateString('en-US', { month: 'short' })
        });
        current.setMonth(current.getMonth() + 1);
    }
    
    return months;
}

function renderMonthLabels(startDate, endDate) {
    const monthsLabels = document.getElementById('monthsLabels');
    monthsLabels.innerHTML = '';

    const months = getMonthsBetween(startDate, endDate);
    months.forEach((month, index) => {
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = month.label;
        monthLabel.style.flex = '1';
        monthsLabels.appendChild(monthLabel);
    });
}

function adjustTooltipPosition(cell, tooltip) {
    const cellRect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = cellRect.top + window.scrollY - tooltipRect.height - 8; // Default: above the cell
    let left = cellRect.left + window.scrollX + (cellRect.width / 2) - (tooltipRect.width / 2);

    // Adjust if the tooltip goes out of the viewport
    if (top < window.scrollY) {
        top = cellRect.bottom + window.scrollY + 8; // Move below the cell
    }
    if (left < window.scrollX) {
        left = window.scrollX + 8; // Align to the left edge
    } else if (left + tooltipRect.width > viewportWidth + window.scrollX) {
        left = viewportWidth + window.scrollX - tooltipRect.width - 8; // Align to the right edge
    }

    // Ensure the tooltip does not go beyond the bottom of the viewport
    if (top + tooltipRect.height > viewportHeight + window.scrollY) {
        top = viewportHeight + window.scrollY - tooltipRect.height - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function showTooltip(cell, text) {
    console.log('Showing tooltip:', text);
    let tooltip = document.querySelector('.tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.textContent = text || 'No data available';
    tooltip.style.position = 'absolute';
    tooltip.style.visibility = 'hidden';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';

    adjustTooltipPosition(cell, tooltip);

    tooltip.style.visibility = 'visible';
    tooltip.style.opacity = '1';
}

function hideTooltip() {
    console.log('Hiding tooltip.');
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
    }
}

async function renderHeatMap() {
    console.log('Rendering heatmap...');
    const heatMapWrapper = document.querySelector('.heat-map-wrapper');
    heatMapWrapper.innerHTML = '';

    // Fetch heatmap data for hover events
    const heatmapData = await loadData(); // Fetch from /api/emotions/heatmap
    const today = new Date();
    const currentDate = new Date(START_DATE);

    let currentMonth = currentDate.getMonth();
    let monthSection = null;
    let monthBox = null;

    while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const scores = heatmapData[dateStr] || [];

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        const averageEmotion = averageScore !== null ? getEmotionState(Math.round(averageScore)) : 'No entry';
        const averageColor = averageScore !== null ? getEmotionColor(Math.round(averageScore)) : getEmotionColor(null);

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.style.background = averageColor;

        const formattedDate = currentDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const tooltipText = scores.length > 0
            ? `${formattedDate}: Overall ${averageEmotion} (Avg. Score: ${averageScore.toFixed(2)})`
            : `${formattedDate}: No entry`;

        // Hover event to show tooltip
        cell.addEventListener('mouseenter', () => showTooltip(cell, tooltipText));
        cell.addEventListener('mouseleave', hideTooltip);

        // Click event to fetch detailed data from /api/emotions for the selected date
        cell.addEventListener('click', async () => {
            console.log(`Fetching detailed data for ${formattedDate}...`);
            try {
                const response = await fetch(`${API_URL}/emotions?date=${dateStr}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch detailed data');
                }
                const detailedData = await response.json();
                const entries = detailedData[dateStr] || [];
                displayNotes(formattedDate, entries);
            } catch (error) {
                console.error('Error fetching detailed data:', error);
                alert('Failed to fetch detailed data. Make sure the server is running.');
            }
        });

        // Create a new month section if the month changes or if it's the first iteration
        if (!monthSection || currentDate.getMonth() !== currentMonth) {
            monthSection = document.createElement('div');
            monthSection.className = 'month-section';

            // Add month label
            const monthLabel = document.createElement('div');
            monthLabel.className = 'month-label';
            monthLabel.textContent = currentDate.toLocaleDateString('en-US', {
                month: 'short',
                year: '2-digit'
            });
            monthSection.appendChild(monthLabel);

            // Add the month box
            monthBox = document.createElement('div');
            monthBox.className = 'month-box';
            monthSection.appendChild(monthBox);

            heatMapWrapper.appendChild(monthSection);
            currentMonth = currentDate.getMonth();
        }

        // Append the day cell to the current month's box
        monthBox.appendChild(cell);

        currentDate.setDate(currentDate.getDate() + 1);
    }
    console.log('Heatmap rendered successfully.');
}

function renderMarkdown(text) {
    if (!text) return '';

    // Sanitize and format text
    const sanitizedText = text
        .replace(/</g, '&lt;') // Escape HTML tags
        .replace(/>/g, '&gt;');

    // Replace Markdown syntax with HTML tags
    const formattedText = sanitizedText
        .replace(/\n/g, '<br>') // Convert newlines to <br>
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // Bold (**text**)
        .replace(/\*(.+?)\*/g, '<em>$1</em>') // Italic (*text*)
        .replace(/`(.+?)`/g, '<code>$1</code>'); // Inline code (`text`)

    return formattedText;
}

async function deleteEntry(date) {
    const formattedDate = ensureDateFormat(date); // Ensure the date is in "YYYY-MM-DD"
    console.log(`Deleting entry for date: ${formattedDate}`);
    try {
        const response = await fetch(`${API_URL}/emotions`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date: formattedDate }), // Use the formatted date
        });

        if (!response.ok) {
            throw new Error('Failed to delete entry');
        }

        console.log('Entry deleted successfully.');
        alert('Entry deleted successfully!');
        await renderHeatMap();
        displayNotes(formattedDate, []); // Clear the notes section for the deleted date
    } catch (error) {
        console.error('Error deleting entry:', error);
        alert('Failed to delete entry. Make sure the server is running.');
    }
}

async function deleteEntryByTag(date, tag) {
    const formattedDate = ensureDateFormat(date); // Ensure the date is in "YYYY-MM-DD"
    console.log(`Deleting entry for date: ${formattedDate}, tag: ${tag}`); // Use the date directly
    try {
        const payload = { date: formattedDate, tag }; // Use the date directly
        console.log('Request payload:', payload); // Log the payload for debugging

        const response = await fetch(`${API_URL}/emotions`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload), // Use the formatted date
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete entry');
        }

        console.log('Entry deleted successfully.');
        alert('Entry deleted successfully!');

        // Refresh the UI after deletion
        await renderHeatMap(); // Refresh the heatmap
        displayNotes(formattedDate, []); // Clear the notes section for the deleted date
    } catch (error) {
        console.error('Error deleting entry:', error.message);
        alert(`Failed to delete entry: ${error.message}`);
    }
}

// Ensure this function is defined in the global scope
function promptDeleteEntry(date, tag) {
    const formattedDate = ensureDateFormat(date); // Ensure the date is in "YYYY-MM-DD"
    if (!formattedDate || !tag) {
        console.error('Date or tag is missing:', { date, tag });
        alert('Date and tag are required to delete an entry.');
        return;
    }

    if (confirm(`Are you sure you want to delete the entry for tag "${tag}" on ${formattedDate}?`)) {
        deleteEntryByTag(formattedDate, tag); // Use the date directly
    }
}

// Modifies the date of an existing entry.
async function modifyEntryDate(oldDate, newDate) {
    console.log(`Modifying entry date from ${oldDate} to ${newDate}`);
    try {
        const response = await fetch(`${API_URL}/emotions/modify-date`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ oldDate, newDate }), // Send both old and new dates
        });

        if (!response.ok) {
            throw new Error('Failed to modify entry date');
        }

        console.log('Entry date modified successfully.');
        alert('Entry date modified successfully!');
        await renderHeatMap(); // Refresh the heatmap after modification
    } catch (error) {
        console.error('Error modifying entry date:', error);
        alert('Failed to modify entry date. Make sure the server is running.');
    }
}

// Ensure the `promptModifyDate` function calls `modifyEntryDate` correctly
function promptModifyDate(oldDate) {
    const formattedOldDate = ensureDateFormat(oldDate); // Ensure the old date is in "YYYY-MM-DD"
    const newDate = prompt('Enter the new date (YYYY-MM-DD):', formattedOldDate); // Use the old date directly
    if (newDate && newDate !== formattedOldDate) {
        modifyEntryDate(formattedOldDate, newDate); // Use the dates directly
    }
}

function displayNotes(date, notesList) {
    const selectedDateElement = document.getElementById('selectedDate');
    const selectedNotesElement = document.getElementById('selectedNotes');
    const notesActionsElement = document.getElementById('notesActions');

    selectedDateElement.textContent = `Selected Date: ${date}`;
    selectedNotesElement.innerHTML = ''; // Clear previous notes
    notesActionsElement.innerHTML = ''; // Clear previous actions

    // Group notes by tags
    const groupedNotes = notesList.reduce((acc, note) => {
        const tag = note.tags || 'No tags';
        if (!acc[tag]) acc[tag] = [];
        acc[tag].push({
            notes: renderMarkdown(note.notes), // Ensure Markdown is rendered here
            emotionState: getEmotionState(note.score),
        });
        return acc;
    }, {});

    // Render grouped notes with emotion state
    selectedNotesElement.innerHTML = Object.entries(groupedNotes)
        .map(([tag, notes]) => `
            <p><strong>Tag:</strong> ${tag}</p>
            <p><strong>Emotion:</strong> ${notes[0].emotionState}</p>
            <p><strong>Notes:</strong></p>
            <ul>
                ${notes.map(note => `
                    <li>
                        ${note.notes} <!-- Rendered Markdown -->
                    </li>
                `).join('')}
            </ul>
            <hr>
        `)
        .join('');

    // Add delete buttons dynamically for each tag
    Object.keys(groupedNotes).forEach(tag => {
        const deleteButton = document.createElement('button');
        deleteButton.textContent = `Delete Entry (${tag})`;
        deleteButton.addEventListener('click', () => promptDeleteEntry(date, tag));
        notesActionsElement.appendChild(deleteButton);
    });

    // Add modify date button only if there are entries
    if (notesList.length > 0) {
        const modifyButton = document.createElement('button');
        modifyButton.id = 'modifyDateButton'; // Add ID for styling
        modifyButton.textContent = 'Modify Date';
        modifyButton.addEventListener('click', () => promptModifyDate(date));
        notesActionsElement.appendChild(modifyButton);
    }
}

async function searchNotes(query) {
    console.log(`Searching notes for query: "${query}"`);
    try {
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Failed to search notes');
        }
        const results = await response.json();
        displaySearchResults(results, query);
    } catch (error) {
        console.error('Error searching notes:', error);
        alert('Failed to search notes. Make sure the server is running.');
    }
}

function displaySearchResults(results, query) {
    const searchResults = document.getElementById('searchResults');
    if (results.length === 0) {
        searchResults.innerHTML = '<p>No matching notes found.</p>';
        return;
    }

    const highlightQuery = (text, query) => {
        const regex = new RegExp(`(${query})`, 'gi'); // Case-insensitive match
        return text.replace(regex, '<mark>$1</mark>'); // Highlight the matching word
    };

    const filterAndFormatText = (text) => {
        return text
            .split('\n') // Split notes into lines
            .filter(line => line.toLowerCase().includes(query.toLowerCase())) // Keep only lines with the query
            .map(line => highlightQuery(line, query)) // Highlight the query in matching lines
            .join('<br>'); // Join the filtered lines with <br> for HTML rendering
    };

    searchResults.innerHTML = `
        <ul>
            ${results.map(result => {
                const filteredNotes = filterAndFormatText(result.notes);
                if (!filteredNotes) return ''; // Skip if no lines match the query
                return `
                    <li>
                        <strong>${result.date}:</strong><br>
                        ${filteredNotes}
                    </li>
                `;
            }).join('')}
        </ul>
    `;
}

// Attach search functionality
document.getElementById('searchButton').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) {
        alert('Please enter a search query.');
        return;
    }
    searchNotes(query);
});

document.getElementById('refreshButton').addEventListener('click', () => {
    console.log('Refreshing search results...');
    document.getElementById('searchInput').value = ''; // Clear the search input field
    document.getElementById('searchResults').innerHTML = ''; // Clear the search results
});

/**
 * Ensures the date is in the "YYYY-MM-DD" format.
 * @param {string} date - The date string to format.
 * @returns {string} - The formatted date string.
 */
function ensureDateFormat(date) {
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
        console.error(`Invalid date: ${date}`);
        return null;
    }
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}