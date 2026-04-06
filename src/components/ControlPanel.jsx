import { TickerSearch } from './TickerSearch.jsx';
import { MultiSignalSelect } from './MultiSignalSelect.jsx';
import { AuthSection } from './AuthSection.jsx';
import { computeDefaultApiOrigin } from '../utils/apiOrigin.js';

export function ControlPanel({
  ticker,
  onTickerChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  executionMode,
  onExecutionModeChange,
  onLoad,
  loadDisabled,
  entryLong,
  exitLong,
  entryShort,
  exitShort,
  onEntryLongChange,
  onExitLongChange,
  onEntryShortChange,
  onExitShortChange,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onLogout,
  authStatus,
  session,
  loginDisabled,
  statusMessage,
  statusType,
  onInvalidateOdin,
  allTickers
}) {
  return (
    <div className="panel">
      <div className="filters">
        <TickerSearch
          value={ticker}
          onChange={onTickerChange}
          allTickers={allTickers}
          onInvalidateOdin={onInvalidateOdin}
        />
        <div className="field">
          <label htmlFor="startDate">Start Date</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => {
              onStartDateChange(e.target.value);
              onInvalidateOdin();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="endDate">End Date</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => {
              onEndDateChange(e.target.value);
              onInvalidateOdin();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="executionModeSelect">Execution Mode</label>
          <select
            id="executionModeSelect"
            value={executionMode}
            onChange={(e) => {
              onExecutionModeChange(e.target.value);
              onInvalidateOdin();
            }}
          >
            <option value="T+1">T+1 (Next-Day Open)</option>
            <option value="T">T (Signal-Day Close)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="loadBtn">&nbsp;</label>
          <button type="button" id="loadBtn" onClick={onLoad} disabled={loadDisabled}>
            Load Chart
          </button>
        </div>
      </div>

      <div className="filters odin-row">
        <MultiSignalSelect
          label="Entry Long Signals"
          value={entryLong}
          onChange={(v) => {
            onEntryLongChange(v);
            onInvalidateOdin();
          }}
        />
        <MultiSignalSelect
          label="Exit Long Signals"
          value={exitLong}
          onChange={(v) => {
            onExitLongChange(v);
            onInvalidateOdin();
          }}
        />
        <MultiSignalSelect
          label="Entry Short Signals"
          value={entryShort}
          onChange={(v) => {
            onEntryShortChange(v);
            onInvalidateOdin();
          }}
        />
        <MultiSignalSelect
          label="Exit Short Signals"
          value={exitShort}
          onChange={(v) => {
            onExitShortChange(v);
            onInvalidateOdin();
          }}
        />
      </div>

      <AuthSection
        email={email}
        password={password}
        onEmailChange={onEmailChange}
        onPasswordChange={onPasswordChange}
        onLogin={onLogin}
        onLogout={onLogout}
        authStatus={authStatus}
        session={session}
        loginDisabled={loginDisabled}
      />

      <div className="hint">
        Auth: Supabase session (persisted, auto-refresh). API base:{' '}
        <code>{computeDefaultApiOrigin() || window.location.origin}</code>
        {' — '}
        chart markers come from <code>POST /api/analytics/odin-index</code> trades
      </div>

      <div className={'status' + (statusType ? ' ' + statusType : '')}>{statusMessage}</div>
    </div>
  );
}
