import styles from "./Home.module.css";

export default function Home() {
  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">✦</div>
        <h1 className={styles.title}>AI Task Manager</h1>
        <p className={styles.subtitle}>Foundation ready — features coming soon.</p>
      </div>
    </main>
  );
}
