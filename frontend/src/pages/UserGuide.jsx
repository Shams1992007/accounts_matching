import "./UserGuide.css";

export default function UserGuide() {
  return (
    <div className="ugWrap">
      <h1 className="ugTitle">User Guide</h1>
      <p className="ugIntro">
        This tool reconciles two accounting files — typically a bank/QuickBooks export and a
        donor-management export — by finding matching transactions between them. Follow the steps
        below from start to finish.
      </p>

      {/* ── OVERVIEW ── */}
      <section className="ugSection">
        <h2 className="ugSectionTitle">Overview</h2>
        <div className="ugStepGrid">
          <div className="ugOverviewStep">
            <div className="ugOverviewNum">1</div>
            <div>
              <strong>Import</strong> — Upload File A and File B
            </div>
          </div>
          <div className="ugOverviewArrow">→</div>
          <div className="ugOverviewStep">
            <div className="ugOverviewNum">2</div>
            <div>
              <strong>Format</strong> — Map columns to a standard format
            </div>
          </div>
          <div className="ugOverviewArrow">→</div>
          <div className="ugOverviewStep">
            <div className="ugOverviewNum">3</div>
            <div>
              <strong>Compare</strong> — Auto-match rows and review results
            </div>
          </div>
          <div className="ugOverviewArrow">→</div>
          <div className="ugOverviewStep">
            <div className="ugOverviewNum">4</div>
            <div>
              <strong>Export</strong> — Download matched results as CSV or Excel
            </div>
          </div>
        </div>
      </section>

      {/* ── STEP 1 ── */}
      <section className="ugSection">
        <h2 className="ugSectionTitle">
          <span className="ugStepBadge">Step 1</span> Import Files
        </h2>
        <p className="ugSectionDesc">
          Navigate to <strong>Import &amp; Match</strong> in the top navigation.
        </p>
        <ol className="ugList">
          <li>
            Click <strong>Choose File</strong> under <em>File A</em> and select your first file
            (CSV or Excel).
          </li>
          <li>
            Click <strong>Choose File</strong> under <em>File B</em> and select your second file.
          </li>
          <li>
            Click <strong>Import &amp; Save to DB</strong>. Both files are parsed and stored.
          </li>
          <li>
            The table viewer appears below. Use the <strong>File A / File B</strong> toggle to
            preview each file's rows.
          </li>
        </ol>

        <div className="ugCallout ugCalloutWarning">
          <strong>Missing headers?</strong> If the file has title rows above the real column
          headers (e.g. a report title on row 1), a yellow warning box appears. Look at the table,
          find which row contains the real column names, and enter that row number in{" "}
          <em>Real headers are in row #</em>. The preview updates automatically as you type —
          you can also press <strong>Enter</strong> or click outside the field to trigger it
          immediately. Once the preview looks correct, click <strong>Load Now</strong> to apply.
        </div>

        <div className="ugCallout ugCalloutInfo">
          <strong>Previous imports</strong> are listed in the load bar at the top. Select one and
          click <strong>Load</strong> to reload it. You can also replace or delete an existing
          import from the <em>Loaded Import Actions</em> panel.
        </div>
      </section>

      {/* ── STEP 2 ── */}
      <section className="ugSection">
        <h2 className="ugSectionTitle">
          <span className="ugStepBadge">Step 2</span> Format Columns
        </h2>
        <p className="ugSectionDesc">
          Click <strong>Go to Format →</strong> (or the Format step in the breadcrumb). This page
          maps each file's raw columns to a standard named format so both files speak the same
          language.
        </p>
        <ol className="ugList">
          <li>
            In the <strong>File A</strong> panel, choose a target format from the dropdown (e.g.{" "}
            <em>LGL format</em>).
          </li>
          <li>
            For each required column in the format, pick the matching column from your file using
            the dropdown on the right.
          </li>
          <li>
            Repeat for <strong>File B</strong> (e.g. <em>QBO format</em>).
          </li>
          <li>
            A <strong>formatted preview</strong> appears below each panel — verify the data looks
            correct before continuing.
          </li>
          <li>
            Mappings are saved automatically. Next time you load the same import, the mappings will
            be remembered.
          </li>
          <li>
            Click <strong>Go to Compare →</strong> when both panels show correct previews.
          </li>
        </ol>

        <div className="ugCallout ugCalloutInfo">
          <strong>Don't see the format you need?</strong> Go to <strong>Manage Formats</strong> in
          the top nav to create a custom format with the exact column names your files use.
        </div>
      </section>

      {/* ── STEP 3 ── */}
      <section className="ugSection">
        <h2 className="ugSectionTitle">
          <span className="ugStepBadge">Step 3</span> Compare &amp; Match
        </h2>
        <p className="ugSectionDesc">
          The Compare page runs an auto-matching algorithm across both files and shows the results.
        </p>

        <h3 className="ugSubTitle">3a — Configure matching fields</h3>
        <ol className="ugList">
          <li>
            In the <em>Compare Setup</em> panel, confirm the field pairs being compared: Date,
            Name, Category, Amount.
          </li>
          <li>
            Adjust the <strong>Minimum matching fields</strong> threshold if needed (default is 2 —
            a row pair must match at least 2 fields to be considered a match).
          </li>
          <li>
            Click <strong>Run Comparison</strong>.
          </li>
        </ol>

        <h3 className="ugSubTitle">3b — Review matched rows</h3>
        <ol className="ugList">
          <li>
            The <strong>Matched Rows</strong> tab shows every auto-matched pair side by side.
          </li>
          <li>
            Each row shows <strong>Date Match</strong>, <strong>Name Match</strong>,{" "}
            <strong>Category Match</strong>, <strong>Amount Match</strong>, and{" "}
            <strong>Amount Difference</strong> columns — green means matched, red means mismatch.
          </li>
          <li>
            A mismatch on a single field does not mean the pair is wrong — two other fields may
            have matched to justify the pairing.
          </li>
        </ol>

        <h3 className="ugSubTitle">3c — Handle unmatched rows</h3>
        <ol className="ugList">
          <li>
            Click the <strong>Unmatched Rows / Manual Pairing</strong> tab to see rows that the
            algorithm could not automatically pair.
          </li>
          <li>
            Unmatched rows from File A appear on the left, File B on the right.
          </li>
          <li>
            To manually pair a row, use the <em>Manual Pairing</em> dropdowns: select a row from
            File A, select the corresponding row from File B, and click{" "}
            <strong>Add Pair</strong>.
          </li>
          <li>
            Manual pairs appear in the list below and are included in the export.
          </li>
          <li>
            To remove a manual pair, click <strong>Remove</strong> next to it.
          </li>
        </ol>

        <div className="ugCallout ugCalloutInfo">
          <strong>Name matching</strong> uses smart normalization: punctuation differences (periods
          vs colons in names like <em>Isaiah 40.31</em> vs <em>Isaiah 40:31</em>), case differences,
          and extra spaces are all ignored. If the Name field is empty on one side, the{" "}
          <em>Employer/Organization</em> field is used as a fallback.
        </div>
      </section>

      {/* ── STEP 4 ── */}
      <section className="ugSection">
        <h2 className="ugSectionTitle">
          <span className="ugStepBadge">Step 4</span> Export Results
        </h2>
        <p className="ugSectionDesc">
          Export buttons are at the top of the Compare page once a comparison has been run.
        </p>
        <ol className="ugList">
          <li>
            Click <strong>Export CSV</strong> for a plain comma-separated file, or{" "}
            <strong>Export Excel</strong> for a styled spreadsheet.
          </li>
          <li>
            The export contains three sections side by side: <em>File A columns</em> |{" "}
            <em>File B columns</em> | <em>Comparison columns</em>.
          </li>
          <li>
            Comparison columns: Date Match, Name Match, Category Match, Amount Match, Amount
            Difference.
          </li>
          <li>
            The Excel export adds color coding (green = match, red = mismatch), merged section
            headers, frozen header row, and auto-fit column widths.
          </li>
          <li>
            Both matched and manually paired rows are included. Summary/total rows are
            automatically excluded.
          </li>
        </ol>
      </section>

      {/* ── MANAGE FORMATS ── */}
      <section className="ugSection">
        <h2 className="ugSectionTitle">Manage Formats</h2>
        <p className="ugSectionDesc">
          Formats define the standard column names that files are mapped to during the Format step.
          Two formats are pre-loaded: <strong>LGL</strong> and <strong>QBO</strong>. You can create
          your own.
        </p>
        <ol className="ugList">
          <li>
            Click <strong>Manage Formats</strong> in the top navigation.
          </li>
          <li>
            Click <strong>New Format</strong>, enter a key (short identifier, e.g.{" "}
            <em>MYBANK</em>), a label, and the column headers the format uses.
          </li>
          <li>
            Click <strong>Save</strong>. The format will now appear in the Format page dropdowns.
          </li>
          <li>
            To edit an existing format, click <strong>Edit</strong> next to it and update the
            headers.
          </li>
          <li>
            To delete a format, click <strong>Delete</strong>. Deletion is blocked if the format
            is currently used by a saved mapping.
          </li>
        </ol>
      </section>

      {/* ── TIPS ── */}
      <section className="ugSection">
        <h2 className="ugSectionTitle">Tips &amp; Common Issues</h2>
        <div className="ugTipsGrid">
          <div className="ugTip">
            <div className="ugTipTitle">File has title rows at the top</div>
            <div className="ugTipBody">
              After import, if missing headers are detected, use the <em>Real headers are in
              row #</em> control to point to the correct row. The preview updates automatically
              as you type. You can also press <strong>Enter</strong> or click outside the field
              to trigger it immediately. The preview confirms the new column names before you
              click <strong>Load Now</strong>.
            </div>
          </div>
          <div className="ugTip">
            <div className="ugTipTitle">Name shows "false" but records match</div>
            <div className="ugTipBody">
              One system may store the organization name with a period (<em>40.31</em>) while the
              other uses a colon (<em>40:31</em>). The matcher normalizes both, but if you still
              see a mismatch, the names genuinely differ between files — use Manual Pairing.
            </div>
          </div>
          <div className="ugTip">
            <div className="ugTipTitle">Too many or too few auto-matches</div>
            <div className="ugTipBody">
              Adjust the <em>Minimum matching fields</em> threshold in Compare Setup. Raise it to 3
              or 4 for stricter matching (fewer false positives), lower it to 1 for looser matching
              (catches more pairs).
            </div>
          </div>
          <div className="ugTip">
            <div className="ugTipTitle">Refreshing the page</div>
            <div className="ugTipBody">
              The URL preserves your current import and page. Refreshing on the Import or Format
              page reloads your data automatically. Refreshing on the Compare page reloads from the
              Format page (compare results are cached per session).
            </div>
          </div>
          <div className="ugTip">
            <div className="ugTipTitle">Replacing a file</div>
            <div className="ugTipBody">
              In the Import page, load an existing import and use the <em>Replace Both Files</em>{" "}
              section to upload new versions of File A and/or File B without creating a new import
              session.
            </div>
          </div>
          <div className="ugTip">
            <div className="ugTipTitle">Supported file types</div>
            <div className="ugTipBody">
              CSV (<em>.csv</em>) and Excel (<em>.xlsx</em>, <em>.xls</em>) files up to 50 MB are
              supported. Date formats <em>m/d/yy</em> and <em>m/d/yyyy</em> are recognized
              automatically.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
